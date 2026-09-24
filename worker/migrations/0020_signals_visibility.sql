ALTER TABLE invitation_settings
ADD COLUMN signals_visible INTEGER NOT NULL DEFAULT 0 CHECK (signals_visible IN (0, 1));
