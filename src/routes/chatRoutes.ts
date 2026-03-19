import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { getChatThreadMessages, listChatThreads, postChatMessage, startChat } from "../controllers/chatController";

const router = Router();

router.post("/start", authRequired, startChat);
router.get("/threads", authRequired, listChatThreads);
router.get("/threads/:id/messages", authRequired, getChatThreadMessages);
router.post("/messages", authRequired, postChatMessage);

export default router;
