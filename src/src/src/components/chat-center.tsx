"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icons";

type Lang = "ar" | "en";
type Person = { user_id: string; display_name: string; email: string; membership_role: string };
type Chat = {
  channel_id: string;
  kind: string;
  name: string | null;
  topic: string | null;
  is_private: boolean;
  muted: boolean;
  last_message_at: string | null;
  last_preview: string | null;
  unread_count: number;
  other_user_id: string | null;
  other_user_name: string | null;
  member_count: number;
};
type Msg = { id: string; channel_id: string; author_id: string; body: string; created_at: string; deleted_at: string | null };
type PublicChannel = { id: string; name: string | null; topic: string | null };
type Member = { user_id: string; member_role: string };
type Panel = "" | "channel" | "direct" | "browse" | "members";

function mergeMessages(a: Msg[], b: Msg[]): Msg[] {
  const map = new Map<string, Msg>();
  for (const m of a) map.set(m.id, m);
  for (const m of b) map.set(m.id, { ...map.get(m.id), ...m });
  return Array.from(map.values()).sort((x, y) => x.created_at.localeCompare(y.created_at));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0].charAt(0) + (parts.length > 1 ? parts[1].charAt(0) : "")).toUpperCase();
}

const SELECT_MSG = "id,channel_id,author_id,body,created_at,deleted_at";

export default function ChatCenter({
  organizationId,
  userId,
  lang,
  initialChannel,
}: {
  organizationId: string;
  userId: string;
  lang: Lang;
  initialChannel?: string;
}) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const supabase = useMemo(() => createClient(), []);

  const [people, setPeople] = useState<Person[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(initialChannel ?? null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<Panel>("");
  const [filter, setFilter] = useState("");
  const [mobileThread, setMobileThread] = useState(Boolean(initialChannel));
  const [form, setForm] = useState({ name: "", topic: "", priv: false, members: [] as string[] });
  const [publicChannels, setPublicChannels] = useState<PublicChannel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [addIds, setAddIds] = useState<string[]>([]);

  const activeRef = useRef<string | null>(activeId);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  const nameOf = useCallback(
    (id: string) => people.find((p) => p.user_id === id)?.display_name ?? (ar ? "عضو سابق" : "Former member"),
    [people, ar],
  );

  const loadChats = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("list_my_chats", { p_org: organizationId });
    if (e) {
      setError(e.message);
    } else {
      setChats(
        ((data ?? []) as Chat[]).map((c) => ({ ...c, unread_count: Number(c.unread_count), member_count: Number(c.member_count) })),
      );
    }
    setLoadingChats(false);
  }, [organizationId, supabase]);

  const loadMessages = useCallback(
    async (id: string) => {
      const { data, error: e } = await supabase
        .from("chat_messages")
        .select(SELECT_MSG)
        .eq("channel_id", id)
        .order("created_at", { ascending: false })
        .limit(51);
      if (e) {
        setError(e.message);
        return;
      }
      if (activeRef.current !== id) return;
      const rows = (data ?? []) as Msg[];
      setHasMore(rows.length > 50);
      setMessages((prev) => mergeMessages(prev.filter((m) => m.channel_id === id), rows.slice(0, 50)));
    },
    [supabase],
  );

  async function loadOlder() {
    if (!activeId || messages.length === 0) return;
    const { data } = await supabase
      .from("chat_messages")
      .select(SELECT_MSG)
      .eq("channel_id", activeId)
      .lt("created_at", messages[0].created_at)
      .order("created_at", { ascending: false })
      .limit(51);
    const rows = (data ?? []) as Msg[];
    setHasMore(rows.length > 50);
    stick.current = false;
    setMessages((prev) => mergeMessages(prev, rows.slice(0, 50)));
  }

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("list_org_directory", { p_org: organizationId });
      setPeople((data ?? []) as Person[]);
    })();
    void loadChats();
  }, [organizationId, supabase, loadChats]);

  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);
    void supabase.rpc("mark_chat_read", { p_channel: activeId }).then(() => loadChats());
  }, [activeId, loadMessages, loadChats, supabase]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadChats();
      if (activeRef.current) void loadMessages(activeRef.current);
    }, 15000);
    return () => clearInterval(timer);
  }, [loadChats, loadMessages]);

  useEffect(() => {
    const channel = supabase
      .channel("chat-" + organizationId + "-" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `organization_id=eq.${organizationId}` }, (payload) => {
        const m = payload.new as Msg;
        if (m.channel_id === activeRef.current) {
          setMessages((prev) => mergeMessages(prev, [m]));
          if (m.author_id !== userId) void supabase.rpc("mark_chat_read", { p_channel: m.channel_id });
        }
        void loadChats();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `organization_id=eq.${organizationId}` }, (payload) => {
        const m = payload.new as Msg;
        if (m.channel_id === activeRef.current) setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_channel_members", filter: `user_id=eq.${userId}` }, () => {
        void loadChats();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, userId, supabase, loadChats]);

  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, activeId]);

  function onScroll() {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function openChat(id: string) {
    stick.current = true;
    setMessages([]);
    setHasMore(false);
    setPanel("");
    setError("");
    setActiveId(id);
    setMobileThread(true);
    if (typeof window !== "undefined") window.history.replaceState(null, "", "/workspace/chat?c=" + id);
  }

  async function send() {
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    setError("");
    const { error: e } = await supabase.rpc("send_chat_message", { p_channel: activeId, p_body: body });
    if (e) setError(e.message);
    else {
      setDraft("");
      stick.current = true;
      await loadMessages(activeId);
      await loadChats();
    }
    setSending(false);
  }

  function onKey(ev: KeyboardEvent<HTMLTextAreaElement>) {
    if (ev.key === "Enter" && !ev.shiftKey && !ev.nativeEvent.isComposing) {
      ev.preventDefault();
      void send();
    }
  }

  async function removeMessage(id: string) {
    setError("");
    const { error: e } = await supabase.rpc("delete_chat_message", { p_message: id });
    if (e) setError(e.message);
    else setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body: "", deleted_at: new Date().toISOString() } : m)));
  }

  async function createChannel(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError("");
    const { data, error: e } = await supabase.rpc("create_chat_channel", {
      p_org: organizationId,
      p_name: form.name,
      p_topic: form.topic || null,
      p_private: form.priv,
      p_member_ids: form.members,
    });
    if (e) {
      setError(e.message);
      return;
    }
    setForm({ name: "", topic: "", priv: false, members: [] });
    await loadChats();
    openChat(data as string);
  }

  async function startDirect(otherId: string) {
    setError("");
    const { data, error: e } = await supabase.rpc("get_or_create_direct_chat", { p_org: organizationId, p_other: otherId });
    if (e) {
      setError(e.message);
      return;
    }
    await loadChats();
    openChat(data as string);
  }

  async function openBrowse() {
    setPanel("browse");
    setMobileThread(true);
    const { data } = await supabase
      .from("chat_channels")
      .select("id,name,topic")
      .eq("organization_id", organizationId)
      .eq("kind", "channel")
      .eq("is_private", false)
      .order("name");
    setPublicChannels((data ?? []) as PublicChannel[]);
  }

  async function joinChannel(id: string) {
    setError("");
    const { error: e } = await supabase.rpc("join_chat_channel", { p_channel: id });
    if (e) {
      setError(e.message);
      return;
    }
    await loadChats();
    openChat(id);
  }

  async function openMembers() {
    if (!activeId) return;
    setPanel("members");
    setAddIds([]);
    const { data } = await supabase.from("chat_channel_members").select("user_id,member_role").eq("channel_id", activeId);
    setMembers((data ?? []) as Member[]);
  }

  async function addMembers() {
    if (!activeId || addIds.length === 0) return;
    setError("");
    const { error: e } = await supabase.rpc("add_chat_members", { p_channel: activeId, p_user_ids: addIds });
    if (e) setError(e.message);
    else {
      await openMembers();
      await loadChats();
    }
  }

  async function toggleMute(c: Chat) {
    await supabase.rpc("set_chat_muted", { p_channel: c.channel_id, p_muted: !c.muted });
    await loadChats();
  }

  async function leave(c: Chat) {
    setError("");
    const { error: e } = await supabase.rpc("leave_chat_channel", { p_channel: c.channel_id });
    if (e) {
      setError(e.message);
      return;
    }
    setActiveId(null);
    setMessages([]);
    setPanel("");
    setMobileThread(false);
    if (typeof window !== "undefined") window.history.replaceState(null, "", "/workspace/chat");
    await loadChats();
  }

  const active = chats.find((c) => c.channel_id === activeId) ?? null;
  const title = (c: Chat) => (c.kind === "direct" ? (c.other_user_name ?? t("محادثة", "Conversation")) : c.name ?? "");
  const q = filter.trim().toLowerCase();
  const visible = chats.filter((c) => !q || title(c).toLowerCase().includes(q));
  const channelsList = visible.filter((c) => c.kind === "channel");
  const directs = visible.filter((c) => c.kind === "direct");
  const others = people.filter((p) => p.user_id !== userId);
  const myMembership = members.find((m) => m.user_id === userId);
  const timeFmt = (iso: string) => new Date(iso).toLocaleTimeString(ar ? "ar-EG" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  const dayFmt = (iso: string) => new Date(iso).toLocaleDateString(ar ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
  const listTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const same = d.toDateString() === new Date().toDateString();
    return same ? timeFmt(iso) : d.toLocaleDateString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short" });
  };

  function toggleIn(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function renderItem(c: Chat) {
    const isDirect = c.kind === "direct";
    return (
      <button key={c.channel_id} type="button" className={"chat-item" + (c.channel_id === activeId && !panel ? " active" : "")} onClick={() => openChat(c.channel_id)}>
        <span className={"chat-avatar" + (isDirect ? "" : " channel")}>{isDirect ? initials(title(c)) : "#"}</span>
        <span className="chat-item-main">
          <span className="chat-item-top">
            <b>{title(c)}</b>
            <small>{listTime(c.last_message_at)}</small>
          </span>
          <span className="chat-item-sub">
            <span>{c.last_preview || (isDirect ? t("ابدأ المحادثة", "Say hello") : c.topic || t("لا توجد رسائل", "No messages yet"))}</span>
            {c.unread_count > 0 && <span className={"chat-unread" + (c.muted ? " muted" : "")}>{c.unread_count > 99 ? "99+" : c.unread_count}</span>}
          </span>
        </span>
      </button>
    );
  }

  let lastDay = "";

  return (
    <div className={"chat" + (mobileThread ? " thread" : "")}>
      <aside className="chat-side">
        <div className="chat-side-head">
          <h1>{t("المحادثات", "Chat")}</h1>
          <div className="chat-tools">
            <button type="button" className="chat-icon-btn" title={t("محادثة جديدة مع زميل", "New direct message")} aria-label={t("محادثة جديدة مع زميل", "New direct message")} onClick={() => { setPanel("direct"); setMobileThread(true); }}>
              <Icon name="chat" size={16} />
            </button>
            <button type="button" className="chat-icon-btn" title={t("إنشاء قناة", "New channel")} aria-label={t("إنشاء قناة", "New channel")} onClick={() => { setPanel("channel"); setMobileThread(true); }}>
              <Icon name="plus" size={16} />
            </button>
            <button type="button" className="chat-icon-btn" title={t("استعراض القنوات", "Browse channels")} aria-label={t("استعراض القنوات", "Browse channels")} onClick={() => void openBrowse()}>
              <Icon name="search" size={16} />
            </button>
          </div>
        </div>
        <div className="chat-filter">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("تصفية المحادثات…", "Filter conversations…")} aria-label={t("تصفية المحادثات", "Filter conversations")} />
        </div>
        <div className="chat-list">
          {channelsList.length > 0 && <div className="chat-group">{t("القنوات", "Channels")}</div>}
          {channelsList.map(renderItem)}
          {directs.length > 0 && <div className="chat-group">{t("رسائل مباشرة", "Direct messages")}</div>}
          {directs.map(renderItem)}
          {!loadingChats && chats.length === 0 && <div className="chat-empty">{t("لا توجد محادثات بعد.", "No conversations yet.")}</div>}
        </div>
      </aside>

      <section className="chat-main">
        {error && <p className="chat-error" role="alert">{error}</p>}

        {panel === "direct" && (
          <div className="chat-panel">
            <button type="button" className="btn-ghost chat-back" onClick={() => { setPanel(""); setMobileThread(false); }}>{t("رجوع", "Back")}</button>
            <h3>{t("محادثة مباشرة", "New direct message")}</h3>
            <p className="lead">{t("اختر زميلاً من مؤسستك لبدء محادثة خاصة.", "Pick a colleague from your organization to start a private conversation.")}</p>
            {others.length === 0 && <div className="dash-empty">{t("لا يوجد أعضاء آخرون بعد. ادعُ زملاءك من صفحة الأعضاء أولاً.", "There are no other members yet. Invite colleagues from the Members page first.")}</div>}
            {others.map((p) => (
              <button type="button" className="chat-pick" key={p.user_id} onClick={() => void startDirect(p.user_id)}>
                <span className="chat-avatar">{initials(p.display_name)}</span>
                <span>
                  <b>{p.display_name}</b>
                  <small>{p.email}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        {panel === "channel" && (
          <div className="chat-panel">
            <button type="button" className="btn-ghost chat-back" onClick={() => { setPanel(""); setMobileThread(false); }}>{t("رجوع", "Back")}</button>
            <h3>{t("إنشاء قناة", "Create a channel")}</h3>
            <p className="lead">{t("القناة العامة يراها وينضم إليها أي عضو في المؤسسة. الخاصة لمن تضيفهم فقط.", "Public channels can be seen and joined by anyone in the organization. Private channels are for the members you add.")}</p>
            <form onSubmit={createChannel}>
              <label>
                {t("اسم القناة *", "Channel name *")}
                <input required minLength={2} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>
                {t("الموضوع", "Topic")}
                <input maxLength={240} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
              </label>
              <label className="chat-check">
                <input type="checkbox" checked={form.priv} onChange={(e) => setForm({ ...form, priv: e.target.checked })} />
                {t("قناة خاصة (بدعوة فقط)", "Private channel (invite only)")}
              </label>
              {others.length > 0 && <p className="lead" style={{ margin: "14px 0 8px" }}>{t("إضافة أعضاء", "Add members")}</p>}
              {others.map((p) => (
                <label className="chat-check" key={p.user_id}>
                  <input type="checkbox" checked={form.members.includes(p.user_id)} onChange={() => setForm({ ...form, members: toggleIn(form.members, p.user_id) })} />
                  {p.display_name}
                </label>
              ))}
              <div className="btn-row">
                <button className="btn-primary">{t("إنشاء القناة", "Create channel")}</button>
                <button type="button" className="btn-ghost" onClick={() => setPanel("")}>{t("إلغاء", "Cancel")}</button>
              </div>
            </form>
          </div>
        )}

        {panel === "browse" && (
          <div className="chat-panel">
            <button type="button" className="btn-ghost chat-back" onClick={() => { setPanel(""); setMobileThread(false); }}>{t("رجوع", "Back")}</button>
            <h3>{t("القنوات العامة", "Public channels")}</h3>
            <p className="lead">{t("انضم إلى قناة من مؤسستك.", "Join a channel in your organization.")}</p>
            {publicChannels.filter((c) => !chats.some((x) => x.channel_id === c.id)).map((c) => (
              <div className="chat-pick" key={c.id}>
                <span className="chat-avatar channel">#</span>
                <span style={{ flex: 1 }}>
                  <b>{c.name}</b>
                  <small>{c.topic}</small>
                </span>
                <button type="button" className="btn-ghost" onClick={() => void joinChannel(c.id)}>{t("انضمام", "Join")}</button>
              </div>
            ))}
            {publicChannels.filter((c) => !chats.some((x) => x.channel_id === c.id)).length === 0 && <div className="dash-empty">{t("لا توجد قنوات عامة إضافية للانضمام.", "No more public channels to join.")}</div>}
          </div>
        )}

        {panel === "members" && active && (
          <div className="chat-panel">
            <button type="button" className="btn-ghost" style={{ marginBottom: 14 }} onClick={() => setPanel("")}>{t("رجوع إلى المحادثة", "Back to conversation")}</button>
            <h3>{title(active)}</h3>
            <p className="lead">{t(`${members.length} عضو`, `${members.length} members`)}</p>
            {members.map((m) => (
              <div className="chat-pick" key={m.user_id} style={{ cursor: "default" }}>
                <span className="chat-avatar">{initials(nameOf(m.user_id))}</span>
                <span style={{ flex: 1 }}>
                  <b>{nameOf(m.user_id)}</b>
                  <small>{m.member_role === "owner" ? t("مالك القناة", "Channel owner") : ""}</small>
                </span>
              </div>
            ))}
            {active.kind === "channel" && myMembership?.member_role === "owner" && (
              <>
                <p className="lead" style={{ margin: "18px 0 8px" }}>{t("إضافة أعضاء", "Add members")}</p>
                {others.filter((p) => !members.some((m) => m.user_id === p.user_id)).map((p) => (
                  <label className="chat-check" key={p.user_id}>
                    <input type="checkbox" checked={addIds.includes(p.user_id)} onChange={() => setAddIds(toggleIn(addIds, p.user_id))} />
                    {p.display_name}
                  </label>
                ))}
                <div className="btn-row">
                  <button type="button" className="btn-primary" disabled={addIds.length === 0} onClick={() => void addMembers()}>{t("إضافة المحددين", "Add selected")}</button>
                </div>
              </>
            )}
            <div className="btn-row" style={{ marginTop: 22 }}>
              <button type="button" className="btn-ghost" onClick={() => void toggleMute(active)}>{active.muted ? t("إلغاء كتم الإشعارات", "Unmute notifications") : t("كتم الإشعارات", "Mute notifications")}</button>
              {active.kind === "channel" && <button type="button" className="btn-ghost" onClick={() => void leave(active)}>{t("مغادرة القناة", "Leave channel")}</button>}
            </div>
          </div>
        )}

        {!panel && !active && (
          <div className="chat-empty">
            <strong>{t("تواصل مع فريقك", "Talk with your team")}</strong>
            {t("اختر محادثة من القائمة، أو ابدأ محادثة مع زميل أو أنشئ قناة لفريق أو موضوع. المحادثات متاحة لأعضاء مؤسستك فقط.", "Pick a conversation, message a colleague, or create a channel for a team or topic. Conversations are visible only to members of your organization.")}
            <div className="btn-row">
              <button type="button" className="btn-primary" onClick={() => setPanel("direct")}>{t("محادثة جديدة", "New message")}</button>
              <button type="button" className="btn-ghost" onClick={() => setPanel("channel")}>{t("قناة جديدة", "New channel")}</button>
            </div>
          </div>
        )}

        {!panel && !active && activeId && !loadingChats && (
          <div className="chat-empty">{t("هذه المحادثة غير متاحة لك.", "This conversation is not available to you.")}</div>
        )}

        {!panel && active && (
          <>
            <div className="chat-head">
              <div className="chat-head-main">
                <button type="button" className="chat-icon-btn chat-back" aria-label={t("رجوع", "Back")} onClick={() => setMobileThread(false)}>
                  <Icon name="arrow" size={15} />
                </button>
                <span className={"chat-avatar" + (active.kind === "direct" ? "" : " channel")}>{active.kind === "direct" ? initials(title(active)) : "#"}</span>
                <div style={{ minWidth: 0 }}>
                  <h2>{title(active)}</h2>
                  <small>{active.kind === "direct" ? t("محادثة خاصة", "Private conversation") : (active.topic ? active.topic + " · " : "") + t(`${active.member_count} عضو`, `${active.member_count} members`) + (active.is_private ? " · " + t("خاصة", "private") : "")}</small>
                </div>
              </div>
              <button type="button" className="btn-ghost" onClick={() => void openMembers()}>{t("الأعضاء والإعدادات", "Members & settings")}</button>
            </div>
            <div className="chat-msgs" ref={listRef} onScroll={onScroll}>
              {hasMore && <button type="button" className="chat-older" onClick={() => void loadOlder()}>{t("تحميل رسائل أقدم", "Load older messages")}</button>}
              {messages.length === 0 && <div className="chat-empty">{t("لا توجد رسائل بعد. كن أول من يكتب.", "No messages yet. Be the first to write.")}</div>}
              {messages.map((m) => {
                const day = m.created_at.slice(0, 10);
                const sep = day !== lastDay;
                lastDay = day;
                const name = nameOf(m.author_id);
                return (
                  <div key={m.id} style={{ display: "contents" }}>
                    {sep && <div className="chat-day">{dayFmt(m.created_at)}</div>}
                    <div className="chat-msg">
                      <span className="chat-avatar">{initials(name)}</span>
                      <div className="chat-msg-body">
                        <div className="chat-msg-meta">
                          <b>{m.author_id === userId ? t("أنت", "You") : name}</b>
                          <small>{timeFmt(m.created_at)}</small>
                        </div>
                        {m.deleted_at ? <p className="chat-text deleted">{t("تم حذف هذه الرسالة", "This message was deleted")}</p> : <p className="chat-text">{m.body}</p>}
                      </div>
                      {m.author_id === userId && !m.deleted_at && (
                        <button type="button" className="chat-msg-del" aria-label={t("حذف الرسالة", "Delete message")} onClick={() => void removeMessage(m.id)}>
                          <Icon name="trash" size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="chat-composer">
              <textarea
                rows={2}
                maxLength={4000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                placeholder={t("اكتب رسالة… (Enter للإرسال، Shift+Enter لسطر جديد)", "Write a message… (Enter to send, Shift+Enter for a new line)")}
                aria-label={t("نص الرسالة", "Message text")}
              />
              <button type="button" className="chat-send" disabled={sending || !draft.trim()} onClick={() => void send()} aria-label={t("إرسال", "Send")}>
                <Icon name="send" size={18} />
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
