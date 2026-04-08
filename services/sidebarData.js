const Collection = require('../models/Collection');
const Chat = require('../models/Chat');

async function getSidebarData() {
  const collections = await Collection.find().sort({ updatedAt: -1 }).lean();
  for (const col of collections) {
    col.chats = await Chat.find({ collectionId: col._id }).sort({ updatedAt: -1 }).limit(5).lean();
  }
  const orphanChats = await Chat.find({ collectionId: null }).sort({ updatedAt: -1 }).limit(10).lean();
  return { collections, orphanChats };
}

module.exports = { getSidebarData };
