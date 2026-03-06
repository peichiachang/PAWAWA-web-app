/** Vercel 僅部署「專案根目錄 api/」；此檔轉交給 app/api 的實作。 */
const { createAiRouteHandler } = require('../../app/api/_lib/ai');
module.exports = createAiRouteHandler('feeding');
