export default () => {
  const port = process.env.PORT
  const cmsApiUrl = process.env.CMS_API_URL
  const jwtSecret = process.env.JWT_SECRET

  if (!port) throw new Error('PORT environment variable is required')
  if (!cmsApiUrl) throw new Error('CMS_API_URL environment variable is required')
  if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required')

  return {
    port: parseInt(port, 10),
    cmsApiUrl,
    jwtSecret,
  }
}
