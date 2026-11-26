const places = [
  ["Ember & Dough", "Wood-fired margherita", "Pizza", "Lively", "€€", "Thin crust, a hot oven, and a few tables out front."],
  ["Lemon Yard", "Charcoal souvlaki", "Greek", "Outdoor tables", "€€", "Lemon, warm pita, and skewers served straight from the grill."],
  ["Night Noodles", "Creamy miso ramen", "Japanese", "Casual", "€€", "A small noodle bar with rich broth and counter seats."],
  ["Fig & Flour", "Handmade sage gnocchi", "Italian", "Cozy", "€€", "Soft gnocchi with brown butter in a quiet dining room."],
  ["Double Stack", "Smashed cheeseburger", "Burgers", "Casual", "€", "Crisp-edged patties, fries, and a short menu."],
  ["Salt & Lime", "Citrus ceviche", "Seafood", "Bright", "€€€", "Citrusy seafood with chili, red onion, and plenty of lime."],
  ["Green Torch", "Spicy mushroom tacos", "Mexican", "Vegetarian options", "€€", "Smoky mushrooms and punchy salsa in a soft tortilla."],
  ["Coconut Lane", "Yellow coconut curry", "Thai", "Cozy", "€€", "Fragrant coconut curry and rice in a relaxed little room."],
  ["Little Plates", "Greek meze to share", "Greek", "Groups", "€€", "Order a few small plates and pass them around."],
  ["Juniper Grill", "Steak frites", "Bistro", "Quiet", "€€€", "Rosemary steak and crisp fries at a low-lit corner table."],
  ["Tahini Table", "Herby falafel bowl", "Middle Eastern", "Vegetarian options", "€", "Falafel, bright pickles, crunchy greens, and a generous drizzle of tahini."],
  ["Orange Hour", "Negroni and olives", "Cocktail bar", "Low-lit", "€€", "A pre-dinner drink with something salty to snack on."],
  ["Basil Corner", "Margherita with fresh basil", "Pizza", "Casual", "€€", "A shared pizza in a small neighborhood kitchen."],
  ["The Lemon Skewer", "Grilled chicken and pita", "Greek", "Groups", "€", "A quick stop for skewers, pita, and cold drinks."],
  ["Broth House", "Miso noodle bowls", "Japanese", "Cozy", "€€", "A warm bowl of noodles at a handful of shared tables."],
  ["Cedar Cantina", "Mushroom street tacos", "Mexican", "Casual", "€€", "A short taco menu with a spicy mushroom filling."],
  ["Olive Steps", "Shared meze spread", "Greek", "Outdoor tables", "€€", "Little plates, cool dips, and tables along the pavement."],
  ["After Six", "Negroni aperitivo", "Cocktail bar", "Quiet", "€€", "A compact dinner-drinks spot with classic aperitifs."],
  ["Saturday Club", "Blueberry ricotta pancakes", "Brunch", "Groups", "€€", "A bright breakfast room with fluffy pancakes and shared tables."],
  ["Toast Garden", "Poached eggs on avocado toast", "Brunch", "Vegetarian options", "€€", "Sourdough toast, soft eggs, and a few seats by the window."],
  ["Red Skillet", "Tomato shakshuka", "Brunch", "Cozy", "€€", "Eggs baked in spiced tomato sauce, with bread for dipping."],
  ["Bagel Corner", "Smoked salmon bagel", "Brunch", "Casual", "€", "Seeded bagels, cream cheese, and coffee to sip outside."],
  ["Morning Fig", "Berry French toast", "Brunch", "Cozy", "€€", "Golden French toast with yogurt and fruit in a small sunny café."],
  ["Butter & Steam", "Croissant and cappuccino", "Bakery café", "Quiet", "€", "Flaky pastries with espresso at a few counter seats."],
  ["Pink Hour", "Grapefruit spritz", "Cocktail bar", "Outdoor tables", "€€", "Citrus spritzes and a few tables on the terrace."],
  ["Afterglow", "Espresso martini", "Cocktail bar", "Low-lit", "€€", "A small bar with espresso cocktails and velvet booths."],
  ["The Green Light", "Basil and lime gimlet", "Cocktail bar", "Quiet", "€€", "Herbal cocktails and a room quiet enough to talk."],
  ["Corner Tap", "Pale ale and pretzels", "Beer bar", "Lively", "€", "Local taps, salty pretzels, and a long communal table."],
  ["Little Vine", "Red wine and a cheese plate", "Wine bar", "Cozy", "€€", "A small selection of wines by the glass and cheeses to share."],
  ["Good Fizz", "Cucumber and mint fizz", "Zero-proof bar", "Groups", "€€", "A drinks list built around alcohol-free spritzes and house sodas."],
];

const extraPhotos = [0, 1, 2, 6, 8, 11];

export const venues = places.map(([name, dish, cuisine, vibe, price, description], id) => ({
  id, name, dish, cuisine, vibe, price, description,
  photo: id >= 18 ? id - 6 : id < 12 ? id : extraPhotos[id - 12],
}));
