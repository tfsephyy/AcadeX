export const MAX_CAPSTONE_BYTES = 128 * 1024 * 1024

export function validateCapstonePdf(file) {
  if (!file || (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name))) return 'Please select a PDF file.'
  if (file.size > MAX_CAPSTONE_BYTES) return `This PDF is ${(file.size / 1048576).toFixed(1)} MiB. The maximum upload size is 128 MiB. Please reduce the file size and try again.`
  return null
}
