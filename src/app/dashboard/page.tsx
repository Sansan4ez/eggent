import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ChatPanel } from "@/components/chat/chat-panel"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  return (
    <div className="[--header-height:calc(--spacing(14))] h-svh overflow-hidden">
      <SidebarProvider className="flex h-full flex-col">
        <SiteHeader title="Chat" />
        <div className="flex min-h-0 flex-1">
          <AppSidebar />
          <SidebarInset className="min-h-0">
            <div className="flex min-h-0 flex-1 flex-col">
              <ChatPanel />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}
