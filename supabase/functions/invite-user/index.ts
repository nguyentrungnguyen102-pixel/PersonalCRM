// invite-user — tao tai khoan moi cho user (chi admin duoc goi). Sinh mat
// khau tam, tao user qua Admin API, gan role vao profiles.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const VALID_ROLES = ['admin', 'editor', 'viewer'] as const
type Role = (typeof VALID_ROLES)[number]

interface InviteBody {
  email: string
  role: Role
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Mat khau tam 14 ky tu: chu hoa/thuong/so/ky tu dac biet, dung crypto random
function generateTempPassword(length = 14): string {
  const charset =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += charset[bytes[i] % charset.length]
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'unauthorized' }, 401)
    }

    const body: InviteBody = await req.json()
    const email = (body.email || '').trim().toLowerCase()
    const role = body.role

    if (!email || !email.includes('@')) {
      return jsonResponse({ error: 'email khong hop le' }, 400)
    }
    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({ error: 'role khong hop le' }, 400)
    }

    // Client dai dien nguoi goi (giu Authorization goc) de kiem tra quyen admin
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: myRole, error: roleErr } = await callerClient.rpc('get_my_role')
    if (roleErr) {
      console.error('rpc get_my_role loi', roleErr.message)
      return jsonResponse({ error: 'khong xac thuc duoc quyen' }, 403)
    }
    if (myRole !== 'admin') {
      return jsonResponse({ error: 'chi admin duoc moi nguoi dung' }, 403)
    }

    // Client service_role: tao user qua Admin API, bypass RLS de sua profiles
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const tempPassword = generateTempPassword()
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (createErr) {
      const msg = createErr.message.toLowerCase()
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        return jsonResponse({ error: 'email da co tai khoan', code: 'exists' }, 409)
      }
      console.error('auth.admin.createUser loi', createErr.message)
      return jsonResponse({ error: 'khong tao duoc tai khoan' }, 500)
    }

    const newUserId = created.user?.id
    if (!newUserId) {
      return jsonResponse({ error: 'khong lay duoc id user moi' }, 500)
    }

    // Trigger handle_new_user da tao profile mac dinh (role='viewer') — cap nhat role yeu cau
    const { error: profileErr } = await adminClient
      .from('profiles')
      .update({ role })
      .eq('id', newUserId)

    if (profileErr) {
      console.error('update profiles role loi', profileErr.message)
      return jsonResponse({ error: 'da tao user nhung khong gan duoc role' }, 500)
    }

    return jsonResponse({ email, temp_password: tempPassword, role })
  } catch (err) {
    console.error('invite-user loi xu ly', err)
    const message = err instanceof Error ? err.message : 'unknown error'
    return jsonResponse({ error: message }, 500)
  }
})
