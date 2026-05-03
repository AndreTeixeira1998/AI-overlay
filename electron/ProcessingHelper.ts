// ProcessingHelper.ts
import fs from "node:fs"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import axios from "axios"
import { BrowserWindow } from "electron"
import { AIService } from './services/AIService';
import { getAnalysisPrompts, getDebugPrompts, getSolutionPrompts } from './constant/prompt';

export class ProcessingHelper {
  private deps: IProcessingHelperDeps
  private screenshotHelper: ScreenshotHelper
  private aiService: AIService;

  // API请求的中止控制器
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps
    this.screenshotHelper = deps.getScreenshotHelper()
    
    // 使用环境变量中的配置初始化AI服务
    const aiConfig = this.deps.getAIConfig();
    this.aiService = new AIService(aiConfig, this.deps.getMainWindow());
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0
    const maxAttempts = 50 // 总共5秒

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      )
      if (isInitialized) return
      await new Promise((resolve) => setTimeout(resolve, 100))
      attempts++
    }
    throw new Error("应用程序在5秒后未能初始化")
  }

  private async getLanguage(): Promise<string> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return "python"

    try {
      await this.waitForInitialization(mainWindow)
      const language = await mainWindow.webContents.executeJavaScript(
        "window.__LANGUAGE__"
      )

      if (
        typeof language !== "string" ||
        language === undefined ||
        language === null
      ) {
        console.warn("语言未正确初始化")
        return "python"
      }

      return language
    } catch (error) {
      console.error("获取语言时出错:", error)
      return "python"
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return
    console.log("执行解决问题功能")

    const view = this.deps.getView()
    console.log("在视图中处理截图:", view)

    if (view === "queue") {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START)
      const screenshotQueue = this.screenshotHelper.getScreenshotQueue()
      console.log("处理所有截图内容:", screenshotQueue)
      if (screenshotQueue.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      try {
        // 初始化中止控制器
        this.currentProcessingAbortController = new AbortController()
        const { signal } = this.currentProcessingAbortController

        const screenshots = await Promise.all(
          screenshotQueue.map(async (path) => ({
            path,
            preview: await this.screenshotHelper.getImagePreview(path),
            data: fs.readFileSync(path).toString("base64")
          }))
        )

        console.log("转换为base64位的字符串->",screenshots)

        const result = await this.processScreenshotsHelper(screenshots, signal)

        if (!result.success) {
          console.log("处理失败:", result.error)
          if (result.error?.includes("OpenAI API key not found")) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              "在环境变量中未找到OpenAI API密钥。请设置OPEN_AI_API_KEY环境变量。"
            )
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              result.error
            )
          }
          // 出错时将视图重置回队列
          console.log("由于错误重置视图到队列")
          this.deps.setView("queue")
          return
        }

        // 只有在处理成功时才将视图设置为解决方案
        console.log("处理成功后将视图设置为解决方案")
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
          result.data
        )
        this.deps.setView("solutions")
      } catch (error: any) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error
        )
        console.error("处理错误:", error)
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "处理被用户取消。"
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error.message || "服务器错误。请重试。"
          )
        }
        // 出错时将视图重置回队列
        console.log("由于错误重置视图到队列")
        this.deps.setView("queue")
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      // view == 'solutions'
      const extraScreenshotQueue =
        this.screenshotHelper.getExtraScreenshotQueue()
      console.log("处理额外队列截图:", extraScreenshotQueue)
      if (extraScreenshotQueue.length === 0) {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START)

      // 初始化中止控制器
      this.currentExtraProcessingAbortController = new AbortController()
      const { signal } = this.currentExtraProcessingAbortController

      try {
        const screenshots = await Promise.all(
          [
            ...this.screenshotHelper.getScreenshotQueue(),
            ...extraScreenshotQueue
          ].map(async (path) => ({
            path,
            preview: await this.screenshotHelper.getImagePreview(path),
            data: fs.readFileSync(path).toString("base64")
          }))
        )
        console.log(
          "合并处理的截图:",
          screenshots.map((s) => s.path)
        )

        const result = await this.processExtraScreenshotsHelper(
          screenshots,
          signal
        )

        if (result.success) {
          this.deps.setHasDebugged(true)
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
            result.data
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            result.error
          )
        }
      } catch (error: any) {
        if (axios.isCancel(error)) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "额外处理被用户取消。"
          )
        } else {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            error.message
          )
        }
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }
  /**
   * 执行调用大模型的请求
   * @param screenshots 截图数组
   * @param signal 中止信号
   * @returns 处理结果
   */
  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const imageDataList = screenshots.map((screenshot) => screenshot.data);
      const mainWindow = this.deps.getMainWindow();
      const language = await this.getLanguage();

      const result = await this.aiService.processWithAI(
        getAnalysisPrompts({language}),
        imageDataList,
        signal,
        (chunk) => {
          // 向渲染器发送部分响应
          mainWindow?.webContents.send(
            this.deps.PROCESSING_EVENTS.PARTIAL_RESPONSE,
            chunk
          );
        }
      );

      if (result.success) {
        const problemInfo = result.data;
        console.log("提取的问题信息:", problemInfo);
        this.deps.setProblemInfo(problemInfo);
        
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
            problemInfo
          );
          
          const solutionsResult = await this.generateSolutionsHelper(signal);
          if (solutionsResult.success) {
            this.screenshotHelper.clearExtraScreenshotQueue();
            return { success: true, data: solutionsResult.data };
          }
        }
      }
      
      return result;

    } catch (error: any) {
      // 现有的错误处理代码...
    }
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();
      
      if (!problemInfo) {
        throw new Error("没有可用的问题信息");
      }

      return await this.aiService.processWithAI(
        getSolutionPrompts({ problemInfo, language }),
        [],
        signal,
        (chunk) => {
          const mainWindow = this.deps.getMainWindow();
          mainWindow?.webContents.send(
            this.deps.PROCESSING_EVENTS.PARTIAL_RESPONSE,
            chunk
          );
        }
      );

    } catch (error: any) {
      // 现有的错误处理代码...
    }
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const imageDataList = screenshots.map((screenshot) => screenshot.data)
      const problemInfo = this.deps.getProblemInfo()
      const language = await this.getLanguage()
      const mainWindow = this.deps.getMainWindow()

      if (!problemInfo) {
        throw new Error("没有可用的问题信息")
      }

      const result = await this.aiService.processWithAI(
        getDebugPrompts({ problemInfo, language }),
        imageDataList,
        signal,
        (chunk) => {
          mainWindow?.webContents.send(
            this.deps.PROCESSING_EVENTS.PARTIAL_RESPONSE,
            chunk
          )
        }
      )

      return result
    } catch (error: any) {
      const mainWindow = this.deps.getMainWindow()

      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "处理被用户取消。"
        }
      }

      if (error.message?.includes("Operation timed out")) {
        // 取消正在进行的API请求
        this.cancelOngoingRequests()
        // 清除两个截图队列
        this.deps.clearQueues()
        // 将视图状态更新为队列
        this.deps.setView("queue")
        // 通知渲染器切换视图
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("reset-view")
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "操作在1分钟后超时。请重试。"
          )
        }
        return {
          success: false,
          error: "操作在1分钟后超时。请重试。"
        }
      }

      return { success: false, error: error.message }
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
      wasCancelled = true
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
      wasCancelled = true
    }

    // 重置hasDebugged标志
    this.deps.setHasDebugged(false)

    // 清除任何待处理状态
    this.deps.setProblemInfo(null)

    const mainWindow = this.deps.getMainWindow()
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      // 发送明确的消息表示处理已取消
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
    }
  }
}
