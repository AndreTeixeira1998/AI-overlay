// ScreenshotHelper.ts

import path from "node:path"
import fs from "node:fs"
import { app } from "electron"
import { v4 as uuidv4 } from "uuid"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

export class ScreenshotHelper {
  private screenshotQueue: string[] = []
  private extraScreenshotQueue: string[] = []
  private readonly MAX_SCREENSHOTS = 2

  private readonly screenshotDir: string
  private readonly extraScreenshotDir: string

  private view: "queue" | "solutions" | "debug" = "queue"

  constructor(view: "queue" | "solutions" | "debug" = "queue") {
    this.view = view

    // Initialize the screenshot directory
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots")
    this.extraScreenshotDir = path.join(
      app.getPath("userData"),
      "extra_screenshots"
    )

    // Ensure the directories exist
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir)
    }
    if (!fs.existsSync(this.extraScreenshotDir)) {
      fs.mkdirSync(this.extraScreenshotDir)
    }
  }

  public setView(view: "queue" | "solutions" | "debug"): void {
    console.log("Setting screenshot view to:", view)
    console.log(
      "Current queue state - main queue:",
      this.screenshotQueue,
      "extra queue:",
      this.extraScreenshotQueue
    )
    this.view = view
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotQueue
  }

  public getExtraScreenshotQueue(): string[] {
    console.log("Getting the extra screenshot queue:", this.extraScreenshotQueue)
    return this.extraScreenshotQueue
  }

  public clearQueues(): void {
    // Clear the main screenshot queue
    this.screenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(`Error deleting screenshot file (path: ${screenshotPath}):`, err)
      })
    })
    this.screenshotQueue = []

    // Clear the extra screenshot queue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            `Error deleting extra screenshot file (path: ${screenshotPath}):`,
            err
          )
      })
    })
    this.extraScreenshotQueue = []
  }

  private async captureScreenshotMac(): Promise<Buffer> {
    const tmpPath = path.join(app.getPath("temp"), `${uuidv4()}.png`)
    await execFileAsync("screencapture", ["-x", tmpPath])
    const buffer = await fs.promises.readFile(tmpPath)
    await fs.promises.unlink(tmpPath)
    return buffer
  }

  private async captureScreenshotWindows(): Promise<Buffer> {
    // Use the native PowerShell screenshot capability
    const tmpPath = path.join(app.getPath("temp"), `${uuidv4()}.png`)
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen
      $bitmap = New-Object System.Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($screen.Bounds.X, $screen.Bounds.Y, 0, 0, $bitmap.Size)
      $bitmap.Save('${tmpPath.replace(/\\/g, "\\\\")}')
      $graphics.Dispose()
      $bitmap.Dispose()
    `
    await execFileAsync("powershell", ["-command", script])
    const buffer = await fs.promises.readFile(tmpPath)
    await fs.promises.unlink(tmpPath)
    return buffer
  }

  public async takeScreenshot(
    hideMainWindow: () => void,
    showMainWindow: () => void
  ): Promise<string> {
    console.log("Current screenshot view mode:", this.view)
    hideMainWindow()
    await new Promise((resolve) => setTimeout(resolve, 100))

    let screenshotPath = ""
    try {
      // Get screenshot buffer using native methods
      const screenshotBuffer =
        process.platform === "darwin"
          ? await this.captureScreenshotMac()
          : await this.captureScreenshotWindows()

      // Save and manage the screenshot based on current view
      if (this.view === "queue") {
        screenshotPath = path.join(this.screenshotDir, `${uuidv4()}.png`)
        await fs.promises.writeFile(screenshotPath, screenshotBuffer)
        console.log("Path added to the main queue:", screenshotPath)
        this.screenshotQueue.push(screenshotPath)
        if (this.screenshotQueue.length > this.MAX_SCREENSHOTS) {
          const removedPath = this.screenshotQueue.shift()
          if (removedPath) {
            try {
              await fs.promises.unlink(removedPath)
              console.log(
                "Removed old screenshot from the main queue:",
                removedPath
              )
            } catch (error) {
              console.error("Error during screenshot capture:", error)
            }
          }
        }
      } else {
        // In the solutions view, only add to the extra queue
        screenshotPath = path.join(this.extraScreenshotDir, `${uuidv4()}.png`)
        await fs.promises.writeFile(screenshotPath, screenshotBuffer)
        console.log("Path added to the extra queue:", screenshotPath)
        this.extraScreenshotQueue.push(screenshotPath)
        if (this.extraScreenshotQueue.length > this.MAX_SCREENSHOTS) {
          const removedPath = this.extraScreenshotQueue.shift()
          if (removedPath) {
            try {
              await fs.promises.unlink(removedPath)
              console.log(
                "Removed old screenshot from the extra queue:",
                removedPath
              )
            } catch (error) {
              console.error("Error during screenshot capture:", error)
            }
          }
        }
      }
    } catch (error) {
      console.error("Error during screenshot capture:", error)
      throw error
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 50))
      showMainWindow()
    }

    return screenshotPath
  }

  public async getImagePreview(filepath: string): Promise<string> {
    try {
      const data = await fs.promises.readFile(filepath)
      return `data:image/png;base64,${data.toString("base64")}`
    } catch (error) {
      console.error("Failed to read image file:", error)
      throw error
    }
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.promises.unlink(path)
      if (this.view === "queue") {
        this.screenshotQueue = this.screenshotQueue.filter(
          (filePath) => filePath !== path
        )
      } else {
        this.extraScreenshotQueue = this.extraScreenshotQueue.filter(
          (filePath) => filePath !== path
        )
      }
      return { success: true }
    } catch (error) {
      console.error("Error deleting file:", error)
      return { success: false, error: error.message }
    }
  }

  public clearExtraScreenshotQueue(): void {
    // Clear the extra screenshot queue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            `Error deleting extra screenshot file (path: ${screenshotPath}):`,
            err
          )
      })
    })
    this.extraScreenshotQueue = []
  }
}
