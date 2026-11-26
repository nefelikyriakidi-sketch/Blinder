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
];

const extraPhotos = [0, 1, 2, 6, 8, 11];

export const venues = places.map(([name, dish, cuisine, vibe, price, description], id) => ({
  id, name, dish, cuisine, vibe, price, description,
  photo: id < 12 ? id : extraPhotos[id - 12],
}));
