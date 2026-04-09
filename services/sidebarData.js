const Collection = require('../models/Collection');
const Chat = require('../models/Chat');

async function getSidebarData() {
  let collections = await Collection.find().sort({ updatedAt: -1 }).lean();

  // Sort: "All Books" always first, then everything else by updatedAt desc
  collections.sort((a, b) => {
    if (a.title === 'All Books') return -1;
    if (b.title === 'All Books') return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  for (const col of collections) {
    col.chats = await Chat.find({ collectionId: col._id }).sort({ updatedAt: -1 }).limit(5).lean();
  }
  const orphanChats = await Chat.find({ collectionId: null }).sort({ updatedAt: -1 }).limit(10).lean();
  return { collections, orphanChats };
}

module.exports = { getSidebarData };
