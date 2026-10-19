import { createContext, useContext } from 'react'

export const ChatbotContext = createContext(null)

export function useChatbotContext() {
    const ctx = useContext(ChatbotContext)
    if (!ctx) throw new Error('useChatbotContext must be used within ChatbotProvider')
    return ctx
}
