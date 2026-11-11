import { expect } from 'chai'
import { formatGitDate } from '@/features/source-control/format-date'
describe('Git timestamp format', () => {
  it('zero-pads day/month/time and uses 24-hour local time independent of locale', () => {
    expect(formatGitDate(new Date(2026,0,2,0,4,5).toISOString())).to.equal('02-01-2026 00:04:05')
    expect(formatGitDate(new Date(2026,10,11,23,8,9).toISOString())).to.equal('11-11-2026 23:08:09')
  })
  it('handles missing or invalid dates without showing Invalid Date', () => {
    expect(formatGitDate('')).to.equal('—')
    expect(formatGitDate('invalid')).to.equal('—')
  })
})
