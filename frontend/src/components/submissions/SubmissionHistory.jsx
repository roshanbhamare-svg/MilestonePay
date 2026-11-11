import { useState } from 'react';
import { ExternalLink, FileText, GitBranch, Image as ImageIcon, History } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import EmptyState from '../common/EmptyState';
import Modal from '../common/Modal';
import { formatDateTime } from '../../utils/formatters';

export default function SubmissionHistory({ submissions = [] }) {
  const [previewImage, setPreviewImage] = useState(null);

  if (!submissions || submissions.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No submissions yet"
        description="Once the freelancer submits deliverables for this milestone, every version appears here."
      />
    );
  }

  return (
    <>
      <div className="flex-col gap-3">
        {submissions.map((sub) => (
          <div
            key={sub._id}
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-app)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="badge badge-info">Version v{sub.version}</span>
                <StatusBadge status={sub.status} />
              </div>
              <span className="text-sm text-dim">
                Submitted {formatDateTime(sub.submittedAt || sub.createdAt)}
                {sub.submittedBy?.name ? ` by ${sub.submittedBy.name}` : ''}
              </span>
            </div>

            {sub.githubUrl && (
              <div className="mb-3">
                <a
                  href={sub.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  <GitBranch size={14} />
                  <span>{sub.githubUrl}</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}

            {sub.notes && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  marginBottom: sub.files?.length ? '12px' : 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {sub.notes}
              </div>
            )}

            {sub.files?.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-muted mb-2">
                  Attached Deliverables ({sub.files.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {sub.files.map((file, idx) => {
                    const isImage =
                      file.fileType === 'image' &&
                      (file.url?.startsWith('data:image/') ||
                        /\.(png|jpe?g|gif|webp)$/i.test(file.url || ''));

                    if (isImage) {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPreviewImage(file)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-strong)',
                            background: 'var(--bg-surface-2)',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          <img
                            src={file.url}
                            alt={file.filename}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '4px',
                              objectFit: 'cover',
                            }}
                          />
                          <span>{file.filename}</span>
                        </button>
                      );
                    }

                    return (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-strong)',
                          background: 'var(--bg-surface-2)',
                          fontSize: '12px',
                        }}
                      >
                        {file.fileType === 'image' ? (
                          <ImageIcon size={15} color="#93c5fd" />
                        ) : (
                          <FileText size={15} color="#c4b5fd" />
                        )}
                        <span>{file.filename}</span>
                        <ExternalLink size={12} color="#94a3b8" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        title={previewImage?.filename || 'Screenshot Preview'}
        size="lg"
        footer={
          previewImage && (
            <a
              href={previewImage.url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
            >
              Open Original <ExternalLink size={13} />
            </a>
          )
        }
      >
        {previewImage && (
          <div style={{ textAlign: 'center' }}>
            <img
              src={previewImage.url}
              alt={previewImage.filename}
              style={{
                maxWidth: '100%',
                maxHeight: '65vh',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
