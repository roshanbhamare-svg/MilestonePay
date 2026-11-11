import { useState } from 'react';
import { Sparkles, Send, Bot, CheckCircle2 } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Alert from '../common/Alert';
import { aiService } from '../../services/aiService';
import { formatDateTime, getErrorMessage } from '../../utils/formatters';

const QUICK_PROMPTS = [
  'Summarize current project progress',
  'Which milestones are overdue or at risk?',
  'What is the PayPal escrow and capture status?',
  'Which milestones need review or revisions?',
];

export default function AIProjectAssistant({ project, milestones = [], payment = null }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const isMock = aiService.isMockMode();

  const handleAsk = async (promptText) => {
    const clean = (promptText ?? question).trim();
    if (!clean) return;

    setError('');
    setAsking(true);
    if (!promptText) setQuestion('');

    try {
      const reply = await aiService.askProjectAssistant({
        projectId: project._id,
        project,
        milestones,
        payment,
        question: clean,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          question: clean,
          ...reply,
        },
      ]);
    } catch (err) {
      setError(getErrorMessage(err, 'Assistant failed to respond'));
    } finally {
      setAsking(false);
    }
  };

  return (
    <Card
      title="AI Project Assistant"
      subtitle="Ask questions about project scope, milestone progress, delays, or payment status."
      action={
        <span className="badge badge-ai">
          <Sparkles size={12} />
          {isMock ? 'Mock AI Service' : 'LangGraph Assistant'}
        </span>
      }
    >
      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            size="sm"
            variant="secondary"
            disabled={asking}
            onClick={() => handleAsk(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="flex gap-2 mb-4"
      >
        <input
          className="form-input"
          placeholder="Ask about deadlines, deliverables, evaluations, or escrow..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" variant="ai" loading={asking} icon={Send}>
          Ask AI
        </Button>
      </form>

      {messages.length === 0 ? (
        <Alert variant="ai" title="Ready to Assist">
          Select a quick prompt above or type a question to generate a real-time summary from this
          project&apos;s milestones and PayPal records.
        </Alert>
      ) : (
        <div className="flex-col gap-4">
          {messages.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-app)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <strong style={{ fontSize: '14px', color: '#c4b5fd' }}>Q: {item.question}</strong>
                <span className="text-sm text-dim">{formatDateTime(item.answeredAt)}</span>
              </div>

              <div className="flex items-start gap-2 mb-3">
                <Bot size={18} color="#93c5fd" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)' }}>
                  {item.answer}
                </p>
              </div>

              {item.highlights?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.highlights.map((hl, idx) => (
                    <span key={idx} className="badge badge-neutral">
                      {hl}
                    </span>
                  ))}
                </div>
              )}

              {item.suggestedNextSteps?.length > 0 && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="text-sm font-semibold text-muted mb-1">Suggested Next Steps</div>
                  <div className="flex-col gap-1">
                    {item.suggestedNextSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-secondary">
                        <CheckCircle2 size={13} color="#10b981" style={{ flexShrink: 0 }} />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
