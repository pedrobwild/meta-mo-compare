-- Instagram media posts
CREATE TABLE IF NOT EXISTS public.ig_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ig_user_id text NOT NULL,
  media_id text NOT NULL,
  media_type text,
  media_url text,
  thumbnail_url text,
  permalink text,
  caption text,
  timestamp timestamptz,
  like_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, media_id)
);

ALTER TABLE public.ig_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage ig_media" ON public.ig_media FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can view ig_media" ON public.ig_media FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Instagram media insights
CREATE TABLE IF NOT EXISTS public.ig_media_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  media_id text NOT NULL,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  engagement integer DEFAULT 0,
  saved integer DEFAULT 0,
  shares integer DEFAULT 0,
  video_views integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, media_id)
);

ALTER TABLE public.ig_media_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage ig_media_insights" ON public.ig_media_insights FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can view ig_media_insights" ON public.ig_media_insights FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Instagram conversations
CREATE TABLE IF NOT EXISTS public.ig_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id text NOT NULL,
  participant_id text,
  participant_name text,
  participant_username text,
  updated_time timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, conversation_id)
);

ALTER TABLE public.ig_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage ig_conversations" ON public.ig_conversations FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can view ig_conversations" ON public.ig_conversations FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Instagram messages
CREATE TABLE IF NOT EXISTS public.ig_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id text NOT NULL,
  message_id text NOT NULL,
  sender_id text,
  message_text text,
  created_time timestamptz,
  is_from_page boolean DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, message_id)
);

ALTER TABLE public.ig_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage ig_messages" ON public.ig_messages FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can view ig_messages" ON public.ig_messages FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Indexes
CREATE INDEX idx_ig_media_workspace_ts ON public.ig_media(workspace_id, timestamp DESC);
CREATE INDEX idx_ig_media_insights_workspace ON public.ig_media_insights(workspace_id, media_id);
CREATE INDEX idx_ig_conversations_workspace ON public.ig_conversations(workspace_id, updated_time DESC);
CREATE INDEX idx_ig_messages_workspace ON public.ig_messages(workspace_id, conversation_id, created_time DESC);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.ig_messages;