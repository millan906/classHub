import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useAnnouncements } from '../../hooks/useAnnouncements'
import { useCourses } from '../../hooks/useCourses'
import { PageHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { PostAnnouncement } from '../../components/announcements/PostAnnouncement'
import { AnnouncementCard } from '../../components/announcements/AnnouncementCard'
import type { Announcement } from '../../types'

export default function FacultyAnnouncements() {
  const { profile } = useAuth()
  const { announcements, postAnnouncement, updateAnnouncement, deleteAnnouncement } = useAnnouncements()
  const { courses } = useCourses()
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null)

  async function handlePost(title: string, body: string, courseId: string | null) {
    if (!profile) return
    await postAnnouncement(title, body, profile.id, courseId)
  }

  async function handleUpdate(id: string, title: string, body: string, courseId: string | null) {
    await updateAnnouncement(id, title, body, courseId)
  }

  return (
    <div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete announcement"
          message={`Delete "${confirmDelete.title}"? This cannot be undone.`}
          onConfirm={async () => {
            try { await deleteAnnouncement(confirmDelete.id); setConfirmDelete(null) }
            catch { /* deletion failed silently — dialog stays open */ }
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <PageHeader title="Announcements" subtitle="Post updates to your class." />
      <PostAnnouncement courses={courses} onPost={handlePost} />
      {announcements.length === 0
        ? <div style={{ fontSize: '13px', color: '#888' }}>No announcements yet.</div>
        : announcements.map(a => (
            <AnnouncementCard
              key={a.id}
              ann={a}
              courses={courses}
              isFaculty
              onUpdate={handleUpdate}
              onDelete={(id) => setConfirmDelete(announcements.find(x => x.id === id) ?? null)}
            />
          ))
      }
    </div>
  )
}
