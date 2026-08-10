import { createContext, useContext, useState } from 'react'

/**
 * ChatbotContext
 *
 * Allows any page to push capstone context into the floating chatbot.
 * Usage in a capstone detail page:
 *
 *   const { setCapstoneContext } = useChatbotContext()
 *   useEffect(() => {
 *     setCapstoneContext({ id: capstone.id, title: capstone.title })
 *     return () => setCapstoneContext(null)   // clear on unmount
 *   }, [capstone])
 */

const ChatbotContext = createContext(null)

export function ChatbotProvider({ children }) {
    const [capstoneContext, setCapstoneContext] = useState(null)

    return (
        <ChatbotContext.Provider value={{ capstoneContext, setCapstoneContext }}>
            {children}
        </ChatbotContext.Provider>
    )
}

export function useChatbotContext() {
    const ctx = useContext(ChatbotContext)
    if (!ctx) throw new Error('useChatbotContext must be used within ChatbotProvider')
    return ctx
}
