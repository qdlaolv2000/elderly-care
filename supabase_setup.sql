-- 适老化改造登记系统 - Supabase 建表 SQL 脚本

-- 1. 创建区域管理表
CREATE TABLE IF NOT EXISTS public.regions (
    id TEXT PRIMARY KEY DEFAULT ('reg_' || md5(random()::text)),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    manager_name TEXT,
    manager_phone TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 写入默认区域
INSERT INTO public.regions (id, name, code, manager_name)
VALUES ('reg_default', '默认通用区域', 'DEFAULT', '系统管理员')
ON CONFLICT (code) DO NOTHING;

-- 2. 创建用户主表
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    region_code TEXT REFERENCES public.regions(code) ON DELETE SET NULL DEFAULT 'DEFAULT',
    referrer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    referrer_name TEXT,
    referral_code TEXT UNIQUE NOT NULL,
    is_free BOOLEAN DEFAULT FALSE,
    manual_free BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT '已预约', -- 已预约 / 施工中 / 已完工
    worker_name TEXT,             -- 施工交付工人
    completed_at TIMESTAMPTZ,     -- 完工交付时间
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 兼容已存在的 users 表结构扩展 (若表已存在)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS region_code TEXT DEFAULT 'DEFAULT';

-- 3. 创建工人授权表
CREATE TABLE IF NOT EXISTS public.workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    region_code TEXT DEFAULT 'ALL', -- ALL 或 特定 region_code
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS region_code TEXT DEFAULT 'ALL';

-- 4. 创建系统参数配置表
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 5. 写入默认免单人数门槛设置（推荐满 5 人完成施工交付后免费）
INSERT INTO public.settings (key, value) 
VALUES ('referral_threshold', '5')
ON CONFLICT (key) DO NOTHING;

-- 6. 开启行级安全策略 (Row Level Security - RLS)
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 7. 创建允许公共读取和写入的策略
CREATE POLICY "Allow public read regions" ON public.regions FOR SELECT USING (true);
CREATE POLICY "Allow public insert regions" ON public.regions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update regions" ON public.regions FOR UPDATE USING (true);

CREATE POLICY "Allow public read access" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.users FOR UPDATE USING (true);

CREATE POLICY "Allow public worker access" ON public.workers FOR ALL USING (true);
CREATE POLICY "Allow public read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Allow public update settings" ON public.settings FOR UPDATE USING (true);

