import React from "react"

interface LanguageSelectorProps {
  currentLanguage: string
  setLanguage: (language: string) => void
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  setLanguage
}) => {
  const handleLanguageChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newLanguage = e.target.value
    setLanguage(newLanguage)
  }

  return (
    <div className="mb-3 px-2 space-y-1">
      <div className=" flex-col items-start justify-between text-[13px] font-medium text-white/90">
        <span>语言</span>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {["java","javascript","python","golang", "kotlin", "sql"].map((language) => (
            <label key={language} className="flex items-center space-x-2">
              <input
                type="radio"
                value={language}
                checked={currentLanguage === language}
                onChange={handleLanguageChange}
                className="bg-white/10 rounded text-sm outline-none border border-white/10 focus:border-white/20"
              />
              <span>{language.charAt(0).toUpperCase() + language.slice(1)}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
