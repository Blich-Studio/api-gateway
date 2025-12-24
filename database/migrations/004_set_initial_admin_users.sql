-- Migration: Set initial admin and writer users
-- Description: Updates specific users to have admin/writer roles and verified status
-- Date: 2025-12-24

-- Set filip@blichstudio.com as writer
UPDATE users 
SET role = 'writer'
WHERE email = 'filip@blichstudio.com';

-- Set admin@blichstudio.com as admin and verify email
UPDATE users 
SET role = 'admin', is_verified = true
WHERE email = 'admin@blichstudio.com';
