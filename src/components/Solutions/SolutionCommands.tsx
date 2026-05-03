import React, { useState, useEffect, useRef } from "react"
import { useToast } from "../../contexts/toast"
import { Screenshot } from "../../types/screenshots"
import { LanguageSelector } from "../shared/LanguageSelector"
import { COMMAND_KEY } from "../../utils/platform"

export interface SolutionCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void
  isProcessing: boolean
  screenshots?: Screenshot[]
  extraScreenshots?: Screenshot[]
  currentLanguage: string
  setLanguage: (language: string) => void
  parentHeight?: number
}

const SolutionCommands: React.FC<SolutionCommandsProps> = ({
  onTooltipVisibilityChange,
  isProcessing,
  currentLanguage,
  setLanguage,
  parentHeight
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()

  useEffect(() => {
    if (onTooltipVisibilityChange) {
      let tooltipHeight = 0
      console.log("tooltipRef.current", tooltipRef.current,parentHeight)
      if (tooltipRef.current && isTooltipVisible&&parentHeight<tooltipHeight+10) {
        tooltipHeight = tooltipRef.current.offsetHeight + 10 // Adjust if necessary
      }
      onTooltipVisibilityChange(isTooltipVisible, tooltipHeight)
    }
  }, [isTooltipVisible, onTooltipVisibilityChange])

  const handleMouseEnter = () => {
    setIsTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setIsTooltipVisible(false)
  }

  return (
    <div>
      <div className="pt-2 w-fit">
        <div className="text-xs text-white/90 backdrop-blur-md bg-black/60 rounded-lg py-2 px-4 flex items-center justify-center gap-4">
          {/* 显示/隐藏 - 始终可见 */}
          <div
            className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
            onClick={async () => {
              try {
                const result = await window.electronAPI.toggleMainWindow()
                if (!result.success) {
                  console.error("切换窗口失败:", result.error)
                  showToast("错误", "切换窗口失败", "error")
                }
              } catch (error) {
                console.error("切换窗口出错:", error)
                showToast("错误", "切换窗口失败", "error")
              }
            }}
          >
            <span className="text-[11px] leading-none">显示/隐藏</span>
            <div className="flex gap-1">
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                {COMMAND_KEY}
              </button>
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                B
              </button>
            </div>
          </div>

          {/* 截图和调试命令 - 仅在未处理时显示 */}
          {/* <div
            className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
            onClick={async () => {
              try {
                const result = await window.electronAPI.triggerScreenshot()
                if (!result.success) {
                  console.error("截图失败:", result.error)
                  showToast("错误", "截图失败", "error")
                }
              } catch (error) {
                console.error("截图出错:", error)
                showToast("错误", "截图失败", "error")
              }
            }}
          >
            <span className="text-[11px] leading-none truncate">
              {extraScreenshots.length === 0
                ? "截取你的代码"
                : "截图"}
            </span>
            <div className="flex gap-1">
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                {COMMAND_KEY}
              </button>
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                H
              </button>
            </div>
          </div> */}

          {/* {extraScreenshots.length > 0 && (
            <div
              className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
              onClick={async () => {
                try {
                  const result =
                    await window.electronAPI.triggerProcessScreenshots()
                  if (!result.success) {
                    console.error("处理截图失败:", result.error)
                    showToast("错误", "处理截图失败", "error")
                  }
                } catch (error) {
                  console.error("处理截图出错:", error)
                  showToast("错误", "处理截图失败", "error")
                }
              }}
            >
              <span className="text-[11px] leading-none">调试</span>
              <div className="flex gap-1">
                <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                  {COMMAND_KEY}
                </button>
                <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                  D
                </button>
              </div>
            </div>
          )} */}

          {/* 重新开始 - 始终可见 */}
          <div
            className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
            onClick={async () => {
              try {
                const result = await window.electronAPI.triggerReset()
                if (!result.success) {
                  console.error("重置失败:", result.error)
                  showToast("错误", "重置失败", "error")
                }
              } catch (error) {
                console.error("重置出错:", error)
                showToast("错误", "重置失败", "error")
              }
            }}
          >
            <span className="text-[11px] leading-none">重新开始</span>
            <div className="flex gap-1">
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                {COMMAND_KEY}
              </button>
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                R
              </button>
            </div>
          </div>

          {/* 分隔线 */}
          <div className="mx-2 h-4 w-px bg-white/20" />

          {/* 设置和工具提示 */}
          <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* 设置图标 */}
            <div className="w-4 h-4 flex items-center justify-center cursor-pointer text-white/70 hover:text-white/90 transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>

            {/* 工具提示内容 */}
            {isTooltipVisible && (
              <div
                ref={tooltipRef}
                className="absolute top-full right-0 mt-2 w-80"
                style={{ zIndex: 100 }}
              >
                {/* 添加透明桥接元素 */}
                <div className="absolute -top-2 right-0 w-full h-2" />
                <div className="p-3 text-xs bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-white/90 shadow-lg">
                  <div className="space-y-4">
                    <h3 className="font-medium whitespace-nowrap">
                      键盘快捷键
                    </h3>
                    <div className="space-y-3">
                      {/* 显示/隐藏项 - 始终可见 */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                        onClick={async () => {
                          try {
                            const result =
                              await window.electronAPI.toggleMainWindow()
                            if (!result.success) {
                              console.error("切换窗口失败:", result.error)
                              showToast("错误", "切换窗口失败", "error")
                            }
                          } catch (error) {
                            console.error("切换窗口出错:", error)
                            showToast("错误", "切换窗口失败", "error")
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">切换窗口</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              B
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                          显示或隐藏此窗口。
                        </p>
                      </div>

                      {/* 截图和调试命令 - 仅在未处理时显示 */}
                      {!isProcessing && (
                        <>
                          <div
                            className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                            onClick={async () => {
                              try {
                                const result =
                                  await window.electronAPI.triggerScreenshot()
                                if (!result.success) {
                                  console.error(
                                    "截图失败:",
                                    result.error
                                  )
                                  showToast(
                                    "错误",
                                    "截图失败",
                                    "error"
                                  )
                                }
                              } catch (error) {
                                console.error("截图出错:", error)
                                showToast(
                                  "错误",
                                  "截图失败",
                                  "error"
                                )
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">截图</span>
                              <div className="flex gap-1 flex-shrink-0">
                                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                                  {COMMAND_KEY}
                                </span>
                                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                                  H
                                </span>
                              </div>
                            </div>
                            <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                              捕获问题或解决方案的其他部分以获取调试帮助。
                            </p>
                          </div>

                          {/* {extraScreenshots.length > 0 && (
                            <div
                              className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                              onClick={async () => {
                                try {
                                  const result =
                                    await window.electronAPI.triggerProcessScreenshots()
                                  if (!result.success) {
                                    console.error(
                                      "处理截图失败:",
                                      result.error
                                    )
                                    showToast(
                                      "错误",
                                      "处理截图失败",
                                      "error"
                                    )
                                  }
                                } catch (error) {
                                  console.error(
                                    "处理截图出错:",
                                    error
                                  )
                                  showToast(
                                    "错误",
                                    "处理截图失败",
                                    "error"
                                  )
                                }
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="truncate">调试</span>
                                <div className="flex gap-1 flex-shrink-0">
                                  <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                                    {COMMAND_KEY}
                                  </span>
                                  <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                                    D
                                  </span>
                                </div>
                              </div>
                              <p className="text-[10px] leading-relaxed text白/70 truncate mt-1">
                                基于所有之前和新添加的截图生成新的解决方案。
                              </p>
                            </div>
                          )} */}
                        </>
                      )}

                      {/* 重新开始 - 始终可见 */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg白/10 transition-colors"
                        onClick={async () => {
                          try {
                            const result =
                              await window.electronAPI.triggerReset()
                            if (!result.success) {
                              console.error("重置失败:", result.error)
                              showToast("错误", "重置失败", "error")
                            }
                          } catch (error) {
                            console.error("重置出错:", error)
                            showToast("错误", "重置失败", "error")
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">重新开始</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg白/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg白/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              R
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text白/70 truncate mt-1">
                          开始一个新的问题。
                        </p>
                      </div>
                    </div>

                    {/* 分隔线和语言选择器 */}
                    <div className="pt-3 mt-3 border-t border白/10">
                      <LanguageSelector
                        currentLanguage={currentLanguage}
                        setLanguage={setLanguage}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SolutionCommands
