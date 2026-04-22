import { test, expect } from './helpers/electron'

test('empty state: no project yet → ProjectStartPanel shown', async ({ page }) => {
  await page.evaluate(() => {
    window.localStorage.removeItem('atelier.projectId')
  })
  await page.reload()
  await page.waitForLoadState('domcontentloaded')

  // Sidebar shows empty state
  await expect(page.getByText(/no project yet/i).first()).toBeVisible({ timeout: 10_000 })
  // Main area shows the create-project hero
  await expect(page.getByRole('heading', { name: /make an ad/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /begin research/i })).toBeVisible()
})

test('create project → CheckpointRouter mounts + sidebar shows company', async ({
  page
}) => {
  await page.evaluate(() => {
    window.localStorage.removeItem('atelier.projectId')
  })
  await page.reload()
  await page.waitForLoadState('domcontentloaded')

  await page.getByLabel(/company name/i).fill('Fahrradwerkstatt Neubau')
  await page.getByLabel(/website/i).fill('https://example.com')

  await page.getByRole('button', { name: /begin research/i }).click()

  // Sidebar should now show the company name (ProjectStartPanel unmounts, CheckpointRouter mounts)
  await expect(page.getByText('Fahrradwerkstatt Neubau').first()).toBeVisible({
    timeout: 15_000
  })
  // Pipeline sidebar should list the 12 steps — pick one to verify
  await expect(page.getByText(/company research/i).first()).toBeVisible()

  // Screenshot the post-start state so a human can sanity-check layout
  await page.screenshot({
    path: 'tests/__snapshots__/pipeline-project-started.png',
    fullPage: true
  })
})
