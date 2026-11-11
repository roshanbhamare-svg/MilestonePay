import { useState } from 'react';
import { GitBranch, Upload, Plus, Trash2, FileText, Image as ImageIcon } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Alert from '../common/Alert';
import { submissionApi } from '../../api/submissionApi';
import { getErrorMessage } from '../../utils/formatters';

function SubmissionModalInner({ onClose, milestone, onSubmitted }) {
  const [githubUrl, setGithubUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [newFilename, setNewFilename] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState('image');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddFileLink = () => {
    if (!newFilename.trim() || !newUrl.trim()) {
      setError('Both filename and URL are required to attach a reference.');
      return;
    }
    setError('');
    setFiles((prev) => [
      ...prev,
      { filename: newFilename.trim(), url: newUrl.trim(), fileType: newType },
    ]);
    setNewFilename('');
    setNewUrl('');
  };

  const handleLocalFileUpload = (event) => {
    const pickedFiles = Array.from(event.target.files || []);
    if (pickedFiles.length === 0) return;

    setError('');
    pickedFiles.forEach((file) => {
      if (file.size > 450 * 1024) {
        setError(
          `File "${file.name}" exceeds 450KB inline limit. Upload it externally and paste its URL instead.`
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const isImg = file.type.startsWith('image/');
        setFiles((prev) => [
          ...prev,
          {
            filename: file.name,
            url: String(reader.result || ''),
            fileType: isImg ? 'image' : 'document',
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  };

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!githubUrl.trim() && files.length === 0 && !notes.trim()) {
      setError('Provide at least a GitHub URL, attached file/screenshot, or submission notes.');
      return;
    }

    if (githubUrl.trim() && !/^https?:\/\/.+/i.test(githubUrl.trim())) {
      setError('GitHub URL must start with http:// or https://');
      return;
    }

    setSubmitting(true);
    try {
      const submission = await submissionApi.submitWork(milestone._id, {
        githubUrl: githubUrl.trim(),
        files,
        notes: notes.trim(),
      });
      onSubmitted(submission);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit deliverables'));
    } finally {
      setSubmitting(false);
    }
  };

  const isResubmit = milestone?.status === 'CHANGES_REQUESTED';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={
        isResubmit
          ? `Resubmit Work — ${milestone?.title}`
          : `Submit Work — ${milestone?.title}`
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={submitting} onClick={handleSubmit}>
            {isResubmit ? 'Submit Updated Version' : 'Submit Deliverables'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {isResubmit && (
          <Alert variant="warning" className="mb-4" title="Modifications Requested">
            Submitting a new version automatically marks this milestone as Resubmitted for client
            and AI evaluation.
          </Alert>
        )}

        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <div className="form-group">
          <label className="form-label flex items-center gap-2">
            <GitBranch size={15} /> GitHub Repository URL
          </label>
          <input
            type="url"
            className="form-input"
            placeholder="https://github.com/username/repository"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
          />
          <span className="form-hint">
            Link to the branch, commit, or repository containing your milestone deliverables.
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Screenshots & Supporting Documents</label>

          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-app)',
              marginBottom: '10px',
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <span className="text-sm text-muted">
                Upload local screenshot/doc (≤ 450KB) or add external URL reference
              </span>
              <label
                className="btn btn-secondary btn-sm"
                style={{ cursor: 'pointer' }}
              >
                <Upload size={14} />
                Upload File
                <input
                  type="file"
                  accept="image/*,.pdf,.md,.txt,.doc,.docx"
                  multiple
                  onChange={handleLocalFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            <div className="flex gap-2 flex-wrap">
              <input
                className="form-input"
                style={{ flex: '1 1 160px' }}
                placeholder="Filename (e.g., dashboard.png)"
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
              />
              <input
                className="form-input"
                style={{ flex: '2 1 220px' }}
                placeholder="https://example.com/screenshot.png"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
              <select
                className="form-select"
                style={{ width: '130px' }}
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                <option value="image">Image</option>
                <option value="document">Document</option>
                <option value="video">Video</option>
                <option value="archive">Archive</option>
              </select>
              <Button size="sm" variant="secondary" icon={Plus} onClick={handleAddFileLink}>
                Add
              </Button>
            </div>
          </div>

          {files.length > 0 && (
            <div className="flex-col gap-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface-2)',
                  }}
                >
                  <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                    {file.fileType === 'image' ? (
                      <ImageIcon size={15} color="#93c5fd" />
                    ) : (
                      <FileText size={15} color="#c4b5fd" />
                    )}
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{file.filename}</span>
                    <span className="badge badge-neutral">{file.fileType}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => handleRemoveFile(idx)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Submission Notes</label>
          <textarea
            className="form-textarea"
            maxLength={3000}
            placeholder="Summarize completed work, testing notes, and how acceptance criteria were met..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <span className="form-hint">{notes.length} / 3000 characters</span>
        </div>
      </form>
    </Modal>
  );
}

export default function SubmissionModal(props) {
  if (!props.isOpen) return null;
  return (
    <SubmissionModalInner
      key={props.milestone?._id || 'submit'}
      {...props}
    />
  );
}
