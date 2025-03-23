import { test, expect, Page } from '@playwright/test';

// Test suite for VideoConference component
test.describe('VideoConference Component E2E Tests', () => {
  let page: Page;

  // Setup before each test
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // Navigate to the page where VideoConference is rendered
    await page.goto('/test-livekit');
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  // Test 1: Component renders correctly
  test('VideoConference component renders properly', async () => {
    // Verify the component is visible
    await expect(page.locator('.video-conference-container')).toBeVisible();
    
    // Verify media controls are visible
    await expect(page.locator('.media-controls')).toBeVisible();
    
    // Verify initial state shows as connecting
    await expect(page.locator('text=Connecting...')).toBeVisible();
  });

  // Test 2: Camera and microphone controls work
  test('Camera and microphone controls toggle correctly', async () => {
    // Wait for connection to establish
    await page.waitForTimeout(3000);
    
    // Test camera toggle
    const cameraButton = page.locator('.camera-control');
    await cameraButton.click();
    // Verify camera disabled UI appears
    await expect(page.locator('.camera-disabled-ui')).toBeVisible();
    // Toggle camera back on
    await cameraButton.click();
    // Verify camera disabled UI disappears
    await expect(page.locator('.camera-disabled-ui')).not.toBeVisible();
    
    // Test microphone toggle
    const micButton = page.locator('.mic-control');
    await micButton.click();
    // Verify mic icon shows as muted
    await expect(micButton).toHaveClass(/mic-disabled/);
    // Toggle mic back on
    await micButton.click();
    // Verify mic icon shows as unmuted
    await expect(micButton).not.toHaveClass(/mic-disabled/);
  });

  // Test 3: Device selection works
  test('Device selection dialog opens and allows selection', async () => {
    // Click device selector button
    const deviceSelectorButton = page.locator('.device-selector');
    await deviceSelectorButton.click();
    
    // Verify device selector dialog appears
    await expect(page.locator('.device-selector-dialog')).toBeVisible();
    
    // Check that camera options are available
    await expect(page.locator('.camera-options')).toBeVisible();
    
    // Check that microphone options are available
    await expect(page.locator('.mic-options')).toBeVisible();
    
    // Select a different camera (if available)
    const cameraOptions = page.locator('.camera-option');
    const count = await cameraOptions.count();
    if (count > 1) {
      await cameraOptions.nth(1).click();
      // Wait for selection to take effect
      await page.waitForTimeout(1000);
    }
    
    // Close the dialog
    await page.locator('.close-device-selector').click();
    // Verify dialog is closed
    await expect(page.locator('.device-selector-dialog')).not.toBeVisible();
  });

  // Test 4: Error handling displays appropriate UI
  test('Error handling shows appropriate error messages', async () => {
    // Simulate a connection error (we'll need to trigger this via the browser)
    await page.evaluate(() => {
      // This simulates a custom event that our application listens for
      window.dispatchEvent(new CustomEvent('livekit:connection-error', {
        detail: { message: 'Connection failed' }
      }));
    });
    
    // Verify error UI appears with correct message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('Connection failed');
    
    // Verify refresh token button appears
    await expect(page.locator('.refresh-token-button')).toBeVisible();
    
    // Click refresh token button
    await page.locator('.refresh-token-button').click();
    
    // Verify error message disappears after refresh
    await page.waitForTimeout(1000);
    await expect(page.locator('.error-message')).not.toBeVisible();
  });

  // Test 5: Permission denial handling
  test('Handles camera and microphone permission denial', async () => {
    // This test requires setting permissions before page load
    // Close the current page
    await page.close();
    
    // Create a new browser context with denied permissions
    const context = await test.browser().newContext({
      permissions: ['geolocation'],
      // Deny camera and mic permissions
      userAgent: 'Playwright Test Agent'
    });
    
    // Open a new page with the denied permissions
    page = await context.newPage();
    await page.goto('/test-livekit');
    await page.waitForLoadState('networkidle');
    
    // Verify permission error message appears
    await expect(page.locator('.permissions-error')).toBeVisible();
    await expect(page.locator('.permissions-error')).toContainText('camera and/or microphone');
    
    // Clean up the context
    await context.close();
  });
}); 