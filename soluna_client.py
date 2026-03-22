from dataclasses import dataclass
import json
from typing import Any, Dict, List, Optional
from urllib import error, parse, request


class SolunaClientError(Exception):
    """Base error for Soluna client failures."""


class SolunaHTTPError(SolunaClientError):
    """Raised when HTTP transport/status errors occur."""

    def __init__(self, status_code: int, message: str, body: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body or {}


class SolunaAPIError(SolunaClientError):
    """Raised when plugin API returns an error payload."""

    def __init__(self, error_code: str, message: str, status_code: int):
        super().__init__(message)
        self.error_code = error_code
        self.status_code = status_code


@dataclass(frozen=True)
class DeviceInfo:
    platform: str
    udid: str
    name: str
    model: str
    os_version: str


@dataclass(frozen=True)
class DeviceLookupResult:
    exists: bool
    device: Optional[DeviceInfo]
    message: Optional[str] = None


@dataclass(frozen=True)
class DeviceListResult:
    count: int
    devices: List[DeviceInfo]


@dataclass(frozen=True)
class CommandExecutionResult:
    ok: bool
    command: str
    args: List[str]
    exit_code: Optional[int]
    timed_out: bool
    truncated: bool
    duration_ms: int
    stdout: str
    stderr: str


class SolunaClient:
    def __init__(self, base_url: str, timeout: float = 10.0, use_env_proxy: bool = False):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.use_env_proxy = use_env_proxy
        self._opener = self._build_opener(use_env_proxy=use_env_proxy)

    def get_device(self, udid: str) -> DeviceLookupResult:
        if not udid or not udid.strip():
            raise ValueError('udid must be a non-empty string')

        query = parse.urlencode({'udid': udid.strip()})
        payload = self._request('GET', f'/soluna/device?{query}')
        value = self._extract_value(payload)

        exists = bool(value.get('exists'))
        device_raw = value.get('device')
        message = value.get('message')

        device = _parse_device(device_raw) if isinstance(device_raw, dict) else None
        return DeviceLookupResult(exists=exists, device=device, message=message)

    def list_devices(self) -> DeviceListResult:
        payload = self._request('GET', '/soluna/devices')
        value = self._extract_value(payload)

        devices_raw = value.get('devices', [])
        if not isinstance(devices_raw, list):
            raise SolunaClientError("Invalid response: 'devices' must be a list")

        devices = [_parse_device(item) for item in devices_raw if isinstance(item, dict)]
        count = int(value.get('count', len(devices)))
        return DeviceListResult(count=count, devices=devices)

    def execute_command(
        self,
        tool: str,
        args: Optional[List[str]] = None,
        timeout_ms: Optional[int] = None,
        max_output_bytes: Optional[int] = None,
    ) -> CommandExecutionResult:
        if tool not in {'adb', 'go-ios', 'ios'}:
            raise ValueError("tool must be one of: adb, go-ios, ios")

        body: Dict[str, Any] = {'tool': tool, 'args': args or []}
        if timeout_ms is not None:
            body['timeoutMs'] = timeout_ms
        if max_output_bytes is not None:
            body['maxOutputBytes'] = max_output_bytes

        payload = self._request('POST', '/soluna/command', body=body)
        value = self._extract_value(payload)

        return CommandExecutionResult(
            ok=bool(value.get('ok')),
            command=str(value.get('command', '')),
            args=list(value.get('args', [])),
            exit_code=value.get('exitCode'),
            timed_out=bool(value.get('timedOut')),
            truncated=bool(value.get('truncated')),
            duration_ms=int(value.get('durationMs', 0)),
            stdout=str(value.get('stdout', '')),
            stderr=str(value.get('stderr', '')),
        )

    def _request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f'{self.base_url}{path}'
        data: Optional[bytes] = None
        headers = {'Accept': 'application/json'}

        if body is not None:
            data = json.dumps(body).encode('utf-8')
            headers['Content-Type'] = 'application/json'

        req = request.Request(url=url, method=method, data=data, headers=headers)

        try:
            with self._opener.open(req, timeout=self.timeout) as resp:
                raw = resp.read().decode('utf-8')
                payload = _safe_json_loads(raw)
                if not isinstance(payload, dict):
                    raise SolunaClientError('Invalid response payload')
                return payload
        except error.HTTPError as exc:
            raw = exc.read().decode('utf-8') if hasattr(exc, 'read') else ''
            payload = _safe_json_loads(raw)
            if isinstance(payload, dict):
                value = payload.get('value')
                if isinstance(value, dict):
                    if 'error' in value:
                        raise SolunaAPIError(
                            error_code=str(value.get('error')),
                            message=str(value.get('message', 'API request failed')),
                            status_code=exc.code,
                        ) from exc
                    # Some plugin endpoints intentionally use non-2xx status while still returning
                    # a normal Appium-style payload under `value` (e.g. not-found, command exit != 0).
                    return payload
            message = f'HTTP request failed: {exc.reason}'
            if exc.code == 502:
                message += (
                    '. Received 502 Bad Gateway, likely from an upstream proxy/load balancer. '
                    "For local Appium plugin calls, use base URL like 'http://127.0.0.1:4723' "
                    'and ensure proxy is disabled (use_env_proxy=False).'
                )
            raise SolunaHTTPError(
                exc.code,
                message,
                payload if isinstance(payload, dict) else None
            ) from exc
        except error.URLError as exc:
            raise SolunaClientError(f'Network error: {exc.reason}') from exc

    @staticmethod
    def _extract_value(payload: Dict[str, Any]) -> Dict[str, Any]:
        value = payload.get('value')
        if not isinstance(value, dict):
            raise SolunaClientError("Invalid response: missing 'value' object")
        if 'error' in value:
            raise SolunaAPIError(
                error_code=str(value.get('error')),
                message=str(value.get('message', 'API request failed')),
                status_code=400,
            )
        return value

    @staticmethod
    def _build_opener(use_env_proxy: bool):
        if use_env_proxy:
            return request.build_opener()
        # Avoid system HTTP(S)_PROXY for local Appium access by default.
        return request.build_opener(request.ProxyHandler({}))


def _safe_json_loads(text: str) -> Any:
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


def _parse_device(raw: Dict[str, Any]) -> DeviceInfo:
    return DeviceInfo(
        platform=str(raw.get('platform', '')),
        udid=str(raw.get('udid', '')),
        name=str(raw.get('name', '')),
        model=str(raw.get('model', '')),
        os_version=str(raw.get('osVersion', '')),
    )
