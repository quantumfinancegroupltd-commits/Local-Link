-- Update the "Cocoa, gold, oil" article hero image to Ghana cocoa trees.
update news_posts set
  hero_image_url = 'https://upload.wikimedia.org/wikipedia/commons/d/db/Beautiful_image_of_Cocoa_tree.jpg',
  hero_image_alt = 'Cocoa trees'
where deleted_at is null and slug = 'ghana-commodities-triangle-cocoa-gold-oil-growth-trap';
