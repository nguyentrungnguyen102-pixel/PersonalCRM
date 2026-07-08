// Muc "Ket noi" trong Cai dat — quan ly tai khoan bot Telegram (bang
// bot_accounts, RLS chi cho admin doc/ghi) va huong dan cau hinh webhook ghi
// cuoc goi Android (MacroDroid) tro toi Edge Function call-log.

import { useCallback, useEffect, useState } from 'react'
import { useLabels } from '../../hooks/useSettings'
import { supabase } from '../../lib/supabase'
import { ConfirmDialog } from '../ConfirmDialog'

// NGOAI LE nhan qua t(): day la DU LIEU CAU HINH co dinh (ten bot Telegram
// that su dang chay), khong phai chuoi giao dien can dich/doi theo ngon
// ngu — hang so FE, sua truc tiep o day neu doi bot.
const BOT_USERNAME = '@personalcrm102_bot'

const CALL_WEBHOOK_URL = 'https://yzlpegtomgtdiwvuvftw.supabase.co/functions/v1/call-log'

interface SectionConnectionsProps {
  showToast: (kind: 'success' | 'error', text: string) => void
}

interface BotAccountRow {
  chat_id: number
  display_name: string | null
  approved: boolean
  created_at: string
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // rơi xuống fallback bên dưới
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    return true
  } catch {
    return false
  }
}

export function SectionConnections({ showToast }: SectionConnectionsProps) {
  const { t } = useLabels()
  const [rows, setRows] = useState<BotAccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('bot_accounts')
      .select('chat_id, display_name, approved, created_at')
      .order('created_at', { ascending: true })
    if (!error && data) setRows(data as BotAccountRow[])
    setLoading(false)
  }, [])

  // Auto-refresh khi mo section (mount).
  useEffect(() => {
    void load()
  }, [load])

  async function handleApprove(chatId: number) {
    setBusyId(chatId)
    const { error } = await supabase.from('bot_accounts').update({ approved: true }).eq('chat_id', chatId)
    setBusyId(null)
    if (error) {
      showToast('error', error.message)
      return
    }
    showToast('success', t('settings.saved'))
    void load()
  }

  async function handleRevoke(chatId: number) {
    setBusyId(chatId)
    const { error } = await supabase.from('bot_accounts').update({ approved: false }).eq('chat_id', chatId)
    setBusyId(null)
    setRevokeTarget(null)
    if (error) {
      showToast('error', error.message)
      return
    }
    showToast('success', t('settings.saved'))
    void load()
  }

  async function handleCopyUrl() {
    const ok = await copyToClipboard(CALL_WEBHOOK_URL)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* --- Bot Telegram --- */}
      <div className="rounded-card border border-line bg-card p-4 md:p-5">
        <h2 className="mb-1 font-heading text-sm font-bold text-ink">{t('bot.telegram')}</h2>
        <p className="mb-1 text-xs text-muted">{t('bot.telegram_hint')}</p>
        <p className="mb-4 font-mono text-xs text-primary">{BOT_USERNAME}</p>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted">{t('bot.no_accounts')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div
                key={row.chat_id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-ink">{row.display_name || row.chat_id}</p>
                  <p className="font-mono text-[10px] text-muted">chat_id: {row.chat_id}</p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    row.approved
                      ? 'border-emerald/30 bg-emerald/15 text-emerald'
                      : 'border-amber/30 bg-amber/15 text-amber'
                  }`}
                >
                  {row.approved ? t('bot.approved') : t('bot.pending')}
                </span>
                {row.approved ? (
                  <button
                    type="button"
                    onClick={() => setRevokeTarget(row.chat_id)}
                    disabled={busyId === row.chat_id}
                    className="flex-shrink-0 rounded-md border border-rose/30 px-2.5 py-1 text-[11px] font-medium text-rose transition-colors hover:bg-rose/10 disabled:opacity-50"
                  >
                    {t('bot.revoke')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleApprove(row.chat_id)}
                    disabled={busyId === row.chat_id}
                    className="flex-shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busyId === row.chat_id ? '…' : t('bot.approve')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Ghi cuộc gọi Android (MacroDroid) --- */}
      <div className="rounded-card border border-line bg-card p-4 md:p-5">
        <h2 className="mb-1 font-heading text-sm font-bold text-ink">{t('bot.call_webhook')}</h2>
        <p className="mb-3 text-xs text-muted">{t('bot.call_hint')}</p>

        <div className="mb-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line bg-bg px-3 py-2 text-[11px] whitespace-nowrap text-ink">
            {CALL_WEBHOOK_URL}
          </code>
          <button
            type="button"
            onClick={() => void handleCopyUrl()}
            className="flex-shrink-0 rounded-lg border border-line px-3 py-2 text-[11px] font-medium text-muted transition-colors hover:text-ink"
          >
            {copied ? t('actions.copied') : t('actions.copy')}
          </button>
        </div>

        {/*
          NGOAI LE nhan qua t(): tu day tro xuong la NOI DUNG HUONG DAN KY
          THUAT (cac buoc cau hinh app MacroDroid cu the tren dien thoai) —
          khong phai chuoi giao dien lap lai can quan ly qua bang nhan, nen
          viet thang tieng Viet trong component theo yeu cau nhiem vu.
        */}
        <div className="rounded-lg border border-line bg-bg p-3 text-xs text-muted">
          <p className="mb-2 font-semibold text-ink">Các bước cấu hình trên MacroDroid:</p>
          <ol className="mb-3 list-decimal space-y-1 pl-4">
            <li>Cài app MacroDroid (Google Play), tạo macro mới.</li>
            <li>
              Trigger: chọn <span className="text-ink">Call Ended</span> (Cuộc gọi kết thúc).
            </li>
            <li>
              Action: chọn <span className="text-ink">HTTP Request</span> (POST), URL dán ở trên, Content-Type{' '}
              <span className="text-ink">application/json</span>.
            </li>
            <li>
              Body JSON (thay <span className="text-ink">&lt;token&gt;</span> bằng token thật):
            </li>
          </ol>
          <pre className="mb-3 overflow-x-auto rounded-md border border-line bg-card p-2 text-[10px] text-ink">
{`{
  "secret": "<token>",
  "phone": "[call_number]",
  "duration_sec": [call_duration],
  "direction": "out"
}`}
          </pre>
          <p>
            [call_number] và [call_duration] là biến MacroDroid cung cấp sẵn — chèn qua nút chèn biến khi soạn
            body. token do quản trị giữ — hỏi Claude/Cài đặt server, không hiển thị trong app vì lý do bảo mật.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={revokeTarget !== null}
        loading={busyId === revokeTarget}
        title={t('bot.revoke')}
        message={t('bot.revoke_confirm')}
        confirmLabel={t('bot.revoke')}
        onConfirm={() => revokeTarget !== null && void handleRevoke(revokeTarget)}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  )
}

export default SectionConnections
