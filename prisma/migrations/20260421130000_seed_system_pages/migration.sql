INSERT INTO "Page" ("id", "slug", "isSystem", "titleNl", "titleEn", "contentNl", "contentEn", "published", "order", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'terms', true, 'Algemene Voorwaarden', 'Terms of Service',
   '# Algemene Voorwaarden\n\nDit zijn de algemene voorwaarden van Dice Vault. Neem contact op voor meer informatie.',
   '# Terms of Service\n\nThese are the terms of service for Dice Vault. Contact us for more information.',
   true, 0, NOW(), NOW()),
  (gen_random_uuid()::text, 'privacy', true, 'Privacybeleid', 'Privacy Policy',
   '# Privacybeleid\n\nDice Vault hecht waarde aan uw privacy. Wij gebruiken alleen essentiële cookies (sessie).',
   '# Privacy Policy\n\nDice Vault values your privacy. We only use essential cookies (session).',
   true, 1, NOW(), NOW()),
  (gen_random_uuid()::text, 'why-bitcoin', true, 'Waarom Bitcoin?', 'Why Bitcoin?',
   '# Waarom Bitcoin?\n\nBitcoin Lightning maakt directe, wereldwijde betalingen mogelijk zonder tussenpartij.',
   '# Why Bitcoin?\n\nBitcoin Lightning enables instant, global payments without intermediaries.',
   true, 2, NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;
