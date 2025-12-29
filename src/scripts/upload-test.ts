import { Storage } from '@google-cloud/storage'
import { randomUUID } from 'crypto'

async function main() {
  const apiEndpoint =
    process.env.GCS_API_ENDPOINT ?? process.env.GCS_PUBLIC_URL ?? 'http://fake-gcs:4443'
  const bucketName = process.env.GCS_BUCKET_NAME ?? 'blich-studio-uploads'
  const projectId = process.env.GCP_PROJECT_ID ?? 'local'

  console.log('Using GCS endpoint:', apiEndpoint)

  const storage = new Storage({ projectId, apiEndpoint })

  // Ensure bucket exists (fake-gcs will create bucket on object write if not existing)
  const filename = `test/${randomUUID()}.png`
  // 1x1 transparent PNG
  const base64Png =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMBAQJ0p4QAAAAASUVORK5CYII='

  const buffer = Buffer.from(base64Png, 'base64')

  const bucket = storage.bucket(bucketName)
  const file = bucket.file(filename)

  // Ensure bucket exists (fake-gcs may not auto-create buckets)
  const [exists] = await bucket.exists()
  if (!exists) {
    console.log(`Bucket ${bucketName} does not exist - creating`)
    await bucket.create()
  }

  console.log(`Uploading ${filename} (${buffer.length} bytes) to bucket ${bucketName}`)
  // Use simple (non-resumable) upload to be compatible with fake-gcs server
  await file.save(buffer, { metadata: { contentType: 'image/png' }, resumable: false })

  console.log('Download back and compare...')
  const [downloaded] = await file.download()

  if (buffer.equals(downloaded)) {
    console.log('SUCCESS: uploaded and downloaded buffers match')
    process.exit(0)
  } else {
    console.error('ERROR: buffers do not match')
    console.error('original first bytes:', buffer.slice(0, 16).toString('hex'))
    console.error('download first bytes:', downloaded.slice(0, 16).toString('hex'))
    process.exit(2)
  }
}

main().catch(err => {
  console.error('Upload test failed:', err)
  process.exit(1)
})
