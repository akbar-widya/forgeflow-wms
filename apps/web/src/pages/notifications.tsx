import { useState } from "react";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications
} from "@/lib/hooks";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/utils";

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(true);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const { data, isLoading } = useNotifications({
    pageSize: 50,
    unreadOnly
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="System alerts, stock shortages and PO discrepancies"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              markAllRead
                .mutateAsync()
                .then(() => toast.success("All notifications marked as read"))
                .catch(() => toast.error("Failed to update notifications"))
            }
          >
            <CheckCheck data-icon="inline-start" />
            Mark all read
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={unreadOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnreadOnly(true)}
        >
          <BellRing data-icon="inline-start" />
          Unread
        </Button>
        <Button
          variant={!unreadOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnreadOnly(false)}
        >
          <Bell data-icon="inline-start" />
          All
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Message</th>
                  <th className="text-right">Created</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((n) => (
                  <tr
                    key={n.id}
                    className={n.readAt ? "opacity-60" : ""}
                  >
                      <td>
                        <StatusBadge kind="severity" value={n.severity} />
                      </td>
                      <td className="font-mono text-xs">{n.type}</td>
                      <td className="font-medium">{n.title}</td>
                      <td className="text-muted-foreground">{n.message}</td>
                      <td className="text-right font-mono text-xs">
                        {formatDateTime(n.createdAt)}
                      </td>
                      <td className="text-right">
                        {!n.readAt && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => markRead.mutate(n.id)}
                          >
                            Mark read
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                {(data?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      <Bell className="mx-auto mb-2 size-5 opacity-50" />
                      No {unreadOnly ? "unread" : ""} notifications.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
