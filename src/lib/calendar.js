// 行政院人事行政總處 115、116 年政府行政機關辦公日曆表。
// 來源：
// 2026 https://www.dgpa.gov.tw/information?pid=12574&uid=82
// 2027 https://www.dgpa.gov.tw/information?pid=12982&uid=55
// 清單包含國定假日本日及依法補假日；一般週六、週日由規則另外判斷。
export const CALENDAR_COVERAGE = Object.freeze({from:'2026-01-01',to:'2027-12-31'})

export const NATIONAL_HOLIDAYS = Object.freeze([
  // 2026
  '2026-01-01',
  '2026-02-15','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20',
  '2026-02-27','2026-02-28',
  '2026-04-03','2026-04-04','2026-04-05','2026-04-06',
  '2026-05-01','2026-06-19','2026-09-25','2026-09-28',
  '2026-10-09','2026-10-10','2026-10-25','2026-10-26','2026-12-25',
  // 2027
  '2027-01-01',
  '2027-02-04','2027-02-05','2027-02-06','2027-02-07','2027-02-08','2027-02-09','2027-02-10',
  '2027-02-28','2027-03-01',
  '2027-04-04','2027-04-05','2027-04-06',
  '2027-04-30','2027-05-01','2027-06-09','2027-09-15','2027-09-28',
  '2027-10-10','2027-10-11','2027-10-25','2027-12-24','2027-12-25','2027-12-31'
])

const holidaySet = new Set(NATIONAL_HOLIDAYS)

export const dateKey = value => {
  if (typeof value === 'string') return value.slice(0,10)
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ''
  const year=value.getFullYear(),month=String(value.getMonth()+1).padStart(2,'0'),day=String(value.getDate()).padStart(2,'0')
  return `${year}-${month}-${day}`
}

export const isOfficialNationalHoliday = value => holidaySet.has(dateKey(value))
