import {expect} from 'chai'
import {__internal as androidInternal} from '../../lib/services/android'
import {__internal as iosInternal} from '../../lib/services/ios'

describe('device parsers', () => {
  it('parses adb devices output', () => {
    const parsed = androidInternal.parseAdbDevices(
      'List of devices attached\nabc123\tdevice\nxyz456\toffline\n\n'
    )
    expect(parsed).to.deep.equal([
      {serial: 'abc123', state: 'device'},
      {serial: 'xyz456', state: 'offline'},
    ])
  })

  it('parses adb getprop output', () => {
    const parsed = androidInternal.parseAndroidProps(
      '[ro.product.model]: [Pixel 8]\n[ro.build.version.release]: [14]\n'
    )
    expect(parsed['ro.product.model']).to.equal('Pixel 8')
    expect(parsed['ro.build.version.release']).to.equal('14')
  })

  it('parses go-ios list details output', () => {
    const parsed = iosInternal.parseGoIosListOutput(
      JSON.stringify({
        deviceList: [
          {
            udid: 'ios-udid-1',
            ProductName: 'iPhone 15',
            ProductType: 'iPhone15,4',
            ProductVersion: '17.5',
          },
        ],
      })
    )
    expect(parsed.deviceList).to.have.length(1)
    expect(parsed.deviceList?.[0].udid).to.equal('ios-udid-1')
  })
})
