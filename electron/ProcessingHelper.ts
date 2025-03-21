// ProcessingHelper.ts
import fs from "node:fs"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { IProcessingHelperDeps } from "./main"
import axios from "axios"
import { app } from "electron"
import { BrowserWindow } from "electron"
import { AIService, AIConfig } from './services/AIService';
import { getAnalysisPrompts, getSolutionPrompts } from './constant/prompt';

const isDev = !app.isPackaged
const API_BASE_URL = isDev
  ? "http://localhost:3000"
  : "https://www.interviewcoder.co"

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

  private async getCredits(): Promise<number> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return 0

    try {
      await this.waitForInitialization(mainWindow)
      const credits = await mainWindow.webContents.executeJavaScript(
        "window.__CREDITS__"
      )
      console.log("获得credit",credits)
      if (
        typeof credits !== "number" ||
        credits === undefined ||
        credits === null
      ) {
        console.warn("积分未正确初始化")
        return 0
      }

      return credits
    } catch (error) {
      console.error("获取积分时出错:", error)
      return 0
    }
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

  private async getAuthToken(): Promise<string | null> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return null

    try {
      await this.waitForInitialization(mainWindow)
      const token = await mainWindow.webContents.executeJavaScript(
        "window.__AUTH_TOKEN__"
      )

      if (!token) {
        console.warn("未找到认证令牌")
        return null
      }

      return token
    } catch (error) {
      console.error("获取认证令牌时出错:", error)
      return null
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.deps.getMainWindow()
    if (!mainWindow) return
    console.log("执行解决问题功能")
    // 检查是否还有剩余积分
    const credits = await this.getCredits()
    console.log("-----",credits)
    if (credits < 1) {
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.OUT_OF_CREDITS)
      return
    }

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
          if (result.error?.includes("API Key out of credits")) {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.OUT_OF_CREDITS
            )
          } else if (result.error?.includes("OpenAI API key not found")) {
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
      const token = await this.getAuthToken()

      if (!problemInfo) {
        throw new Error("没有可用的问题信息")
      }

      if (!token) {
        return {
          success: false,
          error: "需要身份验证。请登录。"
        }
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/debug`,
        { imageDataList, problemInfo, language },
        {
          signal,
          timeout: 300000,
          validateStatus: function (status) {
            return status < 500
          },
          maxRedirects: 5,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          }
        }
      )

      return { success: true, data: response.data }
    } catch (error: any) {
      const mainWindow = this.deps.getMainWindow()

      // 首先处理取消情况
      if (axios.isCancel(error)) {
        return {
          success: false,
          error: "处理被用户取消。"
        }
      }

      if (error.response?.status === 401) {
        if (mainWindow) {
          // 如果身份验证失败，清除任何存储的会话
          await mainWindow.webContents.executeJavaScript(
            "window.supabase?.auth?.signOut()"
          )
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "您的会话已过期。请重新登录。"
          )
        }
        return {
          success: false,
          error: "您的会话已过期。请重新登录。"
        }
      }

      if (error.response?.data?.error === "No token provided") {
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "请登录以继续。"
          )
        }
        return {
          success: false,
          error: "请登录以继续。"
        }
      }

      if (error.response?.data?.error === "Invalid token") {
        if (mainWindow) {
          // 如果令牌无效，清除任何存储的会话
          await mainWindow.webContents.executeJavaScript(
            "window.supabase?.auth?.signOut()"
          )
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "您的会话已过期。请重新登录。"
          )
        }
        return {
          success: false,
          error: "您的会话已过期。请重新登录。"
        }
      }

      if (error.response?.data?.error?.includes("Operation timed out")) {
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

      if (error.response?.data?.error?.includes("API Key out of credits")) {
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.OUT_OF_CREDITS
          )
        }
        return { success: false, error: error.response.data.error }
      }

      if (
        error.response?.data?.error?.includes(
          "Please close this window and re-enter a valid Open AI API key."
        )
      ) {
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.API_KEY_INVALID
          )
        }
        return { success: false, error: error.response.data.error }
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
