import type { Request } from "express";
import { STANDARD_MESSAGE_ALIASES, STANDARD_MESSAGES } from "./standardCatalog";

export const SUPPORTED_LOCALES = ["uz", "ru", "en", "ko"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

type MessageResolver =
  | string
  | ((params: Record<string, string | number | null | undefined>, locale: AppLocale) => string);

export type MessageKey = string;

type MessageCatalog = Record<AppLocale, Record<string, MessageResolver>>;

const localeTags: Record<AppLocale, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-US",
  ko: "ko-KR"
};

const resolveFallbackLocale = (): AppLocale => {
  const raw = String(process.env.APP_FALLBACK_LOCALE || process.env.DEFAULT_LOCALE || "uz").trim().toLowerCase();
  return SUPPORTED_LOCALES.includes(raw as AppLocale) ? (raw as AppLocale) : "uz";
};

export const DEFAULT_LOCALE: AppLocale = resolveFallbackLocale();

const interpolate = (template: string, params: Record<string, string | number | null | undefined>) =>
  template.replace(/\{(\w+)\}/g, (_match, key) => String(params[key] ?? ""));

const messages: MessageCatalog = {
  uz: {
    "common.auth.authorizationHeaderMissing": "Authorization sarlavhasi topilmadi",
    "common.auth.invalidOrExpiredToken": "Token yaroqsiz yoki muddati tugagan",
    "common.auth.notAuthenticated": "Autentifikatsiya talab qilinadi",
    "common.auth.adminSessionRequired": "Admin sessiyasi talab qilinadi",
    "common.auth.adminSessionInvalid": "Admin sessiyasi yaroqsiz yoki bekor qilingan",
    "common.auth.adminAccessRequired": "Admin ruxsati talab qilinadi",
    "common.errors.forbidden": "Ushbu amal uchun ruxsat yo'q",
    "common.errors.server": "Server xatosi",
    "common.notFound.order": "Buyurtma topilmadi",
    "common.notFound.serviceOrder": "Xizmat buyurtmasi topilmadi",
    "common.notFound.service": "Xizmat topilmadi",
    "common.notFound.dispute": "Nizo topilmadi",
    "common.notFound.paymentIntent": "To'lov intenti topilmadi",
    "common.notFound.smsRequest": "SMS so'rovi topilmadi",
    "common.notFound.serviceOwner": "Xizmat egasi topilmadi",
    "common.validation.invalidOrderId": "Buyurtma identifikatori noto'g'ri",
    "common.validation.invalidDisputeId": "Nizo identifikatori noto'g'ri",
    "common.validation.validSourceIdRequired": "Yaroqli sourceId talab qilinadi",
    "common.validation.validPaymentOrOrderRequired": "Yaroqli paymentId yoki orderId talab qilinadi",
    "common.validation.messageRequired": "Xabar kiritilishi shart",
    "common.validation.descriptionOrFileUrlRequired": "description yoki fileUrl talab qilinadi",
    "common.validation.customerFieldsRequired": "customerName, customerPhone va customerAddress majburiy",
    "common.validation.reactionMustBeLikeOrDislike": "reaction like yoki dislike bo'lishi kerak",
    "common.validation.ownServiceOrderNotAllowed": "O'zingizning xizmatingizga buyurtma bera olmaysiz",
    "checkout.trustNotice.default": "Mablag' UniServe tomonidan xavfsiz ushlab turiladi va delivery/completion qoidalari bajarilgandan keyin release qilinadi.",
    "checkout.trustNotice.product": "Mablag' tovar yetkazib berilishi tasdiqlanguncha UniServe escrow tizimida xavfsiz ushlab turiladi.",
    "checkout.trustNotice.service": "Mablag' xizmat yakunlanishi tasdiqlanguncha UniServe escrow tizimida xavfsiz ushlab turiladi.",
    "checkout.mixedOrderDisabled": "Mahsulot va xizmatni birlashtirgan checkout bu relizda yoqilmagan.",
    "checkout.nextSteps.held.1": "To'lov tasdiqlandi va mablag' UniServe escrow hisobida ushlab turildi.",
    "checkout.nextSteps.held.2": "Seller yoki agent fulfillment jarayonini boshlaydi.",
    "checkout.nextSteps.held.3": "Delivery/completion tasdiqlangach payout release jarayoni boshlanadi.",
    "checkout.nextSteps.smsLink.1": "SMS orqali xavfsiz to'lov havolasi yoki invoice yuborildi.",
    "checkout.nextSteps.smsLink.2": "To'lov tasdiqlanmaguncha buyurtma awaiting payment holatida qoladi.",
    "checkout.nextSteps.smsLink.3": "Link muddati tugasa, yangi to'lov sessiyasi yaratish kerak bo'ladi.",
    "checkout.nextSteps.manualTransfer.1": "Bank rekvizitlari yaratildi va reference code biriktirildi.",
    "checkout.nextSteps.manualTransfer.2": "Transfer tekshirilgach buyurtma escrow holatiga o'tadi.",
    "checkout.nextSteps.manualTransfer.3": "Transfer izohida reference code ko'rsatilishi shart.",
    "checkout.nextSteps.pendingVerification.1": "To'lov signali qabul qilindi, lekin verification hali tugamagan.",
    "checkout.nextSteps.pendingVerification.2": "Tasdiqlangach mablag' escrow balansiga o'tkaziladi.",
    "checkout.nextSteps.default.1": "To'lov holati yangilanmoqda.",
    "payment.intent.continue": "To'lovni davom ettirish",
    "payment.intent.smsLinkSent": "SMS havola yuborildi",
    "payment.intent.smsInvoiceSent": "SMS orqali rekvizit yuborildi",
    "payment.intent.bankDetailsReady": "Rekvizitlar yaratildi",
    "payment.intent.infoReady": "To'lov ma'lumotlari tayyor",
    "payment.instructions.smsLink": "SMS ichidagi xavfsiz havolani ochib, muddat tugashidan oldin to'lovni yakunlang.",
    "payment.instructions.smsInvoice": "SMS orqali yuborilgan rekvizitlar bo'yicha to'lang va tasdiqlash uchun chekni saqlang.",
    "payment.instructions.manualTransfer": "Summani qo'lda o'tkazing va izohda reference code'ni ko'rsating.",
    "payment.instructions.manualTransferBank": "Ko'rsatilgan settlement hisobiga umumiy summani o'tkazing. Tekshiruvdan keyin mablag' escrow'ga o'tadi.",
    "payment.instructions.routingNote": "Pul o'tkazmasi izohida aniq reference code'ni ko'rsating.",
    "payment.collection.ready.instant": "Onlayn to'lov sessiyasi tayyor. Mablag' UniServe escrow'ga o'tishi uchun to'lovni yakunlang.",
    "payment.collection.ready.smsLink": "Xavfsiz to'lov havolasi SMS orqali yuborildi. To'lov tasdiqlangach buyurtma faollashadi.",
    "payment.collection.ready.smsInvoice": "Invoice rekvizitlari SMS orqali yuborildi. To'lov tasdiqlangach buyurtma faollashadi.",
    "payment.collection.ready.manualTransfer": "Bank rekvizitlari yaratildi. Transfer verification tugagach buyurtma faollashadi.",
    "payment.collection.smsBody": ({ orderCode, amount, expiry, referenceCode, action }) =>
      `UniServe buyurtma ${orderCode}: ${amount}. Amal qilish muddati ${expiry}. Ref: ${referenceCode}.${action ? ` ${action}` : ""}`,
    "payment.collection.smsSecurityNote": "Xavfsizlik uchun havola yoki rekvizitlarni boshqa shaxslarga yubormang.",
    "payment.failure.expired": "To'lov oynasi muddati tugadi.",
    "payment.failure.cancelled": "To'lov bekor qilindi.",
    "payment.failure.verificationFailed": "To'lov tekshiruvi muvaffaqiyatsiz tugadi.",
    "payment.failure.intentNotFound": "To'lov intenti topilmadi",
    "payment.failure.smsFlowNotConfigured": "Ushbu to'lov intenti uchun SMS oqimi sozlanmagan",
    "payment.status.awaiting_payment.buyer": "To'lov kutilmoqda",
    "payment.status.payment_link_sent.buyer": "To'lov havolasi yuborildi",
    "payment.status.awaiting_manual_transfer.buyer": "Bank o‘tkazmasi kutilmoqda",
    "payment.status.payment_pending_verification.buyer": "To'lov tekshirilmoqda",
    "payment.status.paid.buyer": "To'lov qabul qilindi",
    "payment.status.held_in_escrow.buyer": "Mablag' xavfsizlik uchun UniServe escrow hisobida ushlab turibdi",
    "payment.status.fulfillment_started.buyer": "Buyurtma yoki xizmat bajarilish jarayonida",
    "payment.status.delivered_or_completed.buyer": "Delivery yoki completion qayd etildi",
    "payment.status.awaiting_buyer_confirmation.buyer": "Qabul qilish tasdig'ingiz kutilmoqda",
    "payment.status.dispute_opened.buyer": "Nizo ko'rib chiqilmoqda",
    "payment.status.refund_approved.buyer": "Refund tasdiqlandi",
    "payment.status.release_approved.buyer": "Tekshiruv natijasiga ko'ra mablag' seller yoki agent foydasiga release qilindi",
    "payment.status.released_to_seller_pending_payout.buyer": "Mablag' seller pending payout balansiga o'tkazildi",
    "payment.status.payout_completed.buyer": "Settlement jarayoni yakunlandi",
    "payment.status.payment_failed.buyer": "To'lov amalga oshmadi",
    "payment.status.payment_expired.buyer": "To'lov muddati tugadi",
    "payment.status.cancelled.buyer": "Buyurtma bekor qilindi",
    "payment.status.held_in_escrow.seller": "Buyer to'lovi qabul qilindi va escrow'da ushlab turibdi",
    "payment.status.fulfillment_started.seller": "Buyurtmani bajarishni boshlashingiz mumkin",
    "payment.status.delivered_or_completed.seller": "Delivery yoki completion qayd etildi",
    "payment.status.awaiting_buyer_confirmation.seller": "Buyer tasdig'i kutilmoqda",
    "payment.status.release_approved.seller": "Mablag' pending payout balansingizga o'tkazildi",
    "payment.status.released_to_seller_pending_payout.seller": "Mablag' pending payout balansiga tayyorlandi",
    "payment.status.payout_completed.seller": "To'lov hisobingizga o'tkazildi",
    "payment.status.cancelled.seller": "Buyurtma bekor qilindi",
    "payment.notification.paymentHeld.buyer": ({ sourceLabel, amount, trustCopy }) =>
      `${sourceLabel}: ${amount} qabul qilindi va escrow hisobida ushlab turildi. ${trustCopy}`,
    "payment.notification.paymentHeld.seller": ({ sourceLabel }) =>
      `${sourceLabel}: xaridor to'lovi qabul qilindi. Mablag' delivery yoki completion tasdiqlanguncha escrow holatida saqlanadi.`,
    "payment.notification.awaitingReview.buyer": ({ sourceLabel, reviewWindow }) =>
      `${sourceLabel}: delivery yoki completion qayd etildi. Agar e'tiroz bo'lmasa, mablag' review window yakunida sotuvchiga chiqariladi.${reviewWindow ? ` ${reviewWindow}` : ""}`,
    "payment.notification.awaitingReview.seller": ({ sourceLabel }) =>
      `${sourceLabel}: delivery yoki completion qayd etildi. Buyer review window tugagach yoki buyer tasdiqlagach mablag' pending payout balansingizga o'tadi.`,
    "payment.notification.release.buyer": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: review yoki dispute jarayoniga ko'ra ${amount} sotuvchiga release qilindi. Sabab: ${reason}`,
    "payment.notification.release.seller": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: ${amount} pending payout balansingizga o'tkazildi. Sabab: ${reason}`,
    "payment.notification.refundApproved.buyer": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: ${amount} refund tasdiqlandi. Sabab: ${reason}`,
    "payment.notification.refundDenied.buyer": ({ sourceLabel, reason }) =>
      `${sourceLabel}: refund so'rovi rad etildi. Mablag' sellerga release qilinadi. Sabab: ${reason}`,
    "payment.notification.refundApproved.seller": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: dispute qaroriga ko'ra ${amount} refund xaridorga qaytariladi. Sabab: ${reason}`,
    "payment.notification.refundDenied.seller": ({ sourceLabel, reason }) =>
      `${sourceLabel}: dispute qaroriga ko'ra mablag' sizning pending payout balansingizga chiqariladi. Sabab: ${reason}`,
    "payment.notification.payoutStatus": ({ status, amount, reason }) =>
      `Payout ${status}: ${amount}.${reason ? ` Sabab: ${reason}` : ""}`,
    "payment.method.card.name": "Karta",
    "payment.method.card.description": "UniServe escrow orqali darhol onlayn karta to'lovi.",
    "payment.method.payme.name": "Payme",
    "payment.method.payme.description": "Payme orqali davom eting va tasdiqdan keyin mablag' UniServe escrow'da ushlab turiladi.",
    "payment.method.click.name": "Click",
    "payment.method.click.description": "Click'ka o'tib to'lovni yakunlang, mablag' UniServe escrow'ga qaytadi.",
    "payment.method.kakaopay.name": "KakaoPay",
    "payment.method.kakaopay.description": "UniServe nazoratidagi escrow orqali tezkor wallet to'lovi.",
    "payment.method.sms_payment_link.name": "SMS to'lov havolasi",
    "payment.method.sms_payment_link.description": "Xaridor telefoniga xavfsiz to'lov havolasini yuboradi va tasdiqdan keyin buyurtmani faollashtiradi.",
    "payment.method.sms_invoice.name": "SMS invoice",
    "payment.method.sms_invoice.description": "Keyinroq to'lash uchun SMS orqali rekvizit va reference code yuboriladi.",
    "payment.method.manual_bank_transfer.name": "Qo'lda bank o'tkazmasi",
    "payment.method.manual_bank_transfer.description": "Bank rekvizitlarini ko'rsatadi va transfer verification tugaguncha buyurtmani ushlab turadi.",
    "payment.method.future_psp.name": "Kelajak PSP",
    "payment.method.future_psp.description": "Kelajakdagi PSP integratsiyalari uchun zaxira zamonaviy to'lov usuli.",
    "dispute.default.buyerOpened": "Buyer nizo ochdi.",
    "dispute.default.sellerResponded": "Seller nizoga javob berdi."
  },
  ru: {
    "common.auth.authorizationHeaderMissing": "Заголовок Authorization отсутствует",
    "common.auth.invalidOrExpiredToken": "Токен недействителен или истёк",
    "common.auth.notAuthenticated": "Требуется авторизация",
    "common.auth.adminSessionRequired": "Требуется сессия администратора",
    "common.auth.adminSessionInvalid": "Сессия администратора недействительна или отозвана",
    "common.auth.adminAccessRequired": "Требуется доступ администратора",
    "common.errors.forbidden": "Недостаточно прав для этого действия",
    "common.errors.server": "Ошибка сервера",
    "common.notFound.order": "Заказ не найден",
    "common.notFound.serviceOrder": "Заказ услуги не найден",
    "common.notFound.service": "Услуга не найдена",
    "common.notFound.dispute": "Спор не найден",
    "common.notFound.paymentIntent": "Платёжный intent не найден",
    "common.notFound.smsRequest": "SMS-запрос не найден",
    "common.notFound.serviceOwner": "Владелец услуги не найден",
    "common.validation.invalidOrderId": "Некорректный идентификатор заказа",
    "common.validation.invalidDisputeId": "Некорректный идентификатор спора",
    "common.validation.validSourceIdRequired": "Требуется корректный sourceId",
    "common.validation.validPaymentOrOrderRequired": "Требуется корректный paymentId или orderId",
    "common.validation.messageRequired": "Сообщение обязательно",
    "common.validation.descriptionOrFileUrlRequired": "Требуется description или fileUrl",
    "common.validation.customerFieldsRequired": "customerName, customerPhone и customerAddress обязательны",
    "common.validation.reactionMustBeLikeOrDislike": "reaction должен быть like или dislike",
    "common.validation.ownServiceOrderNotAllowed": "Нельзя заказать собственную услугу",
    "checkout.trustNotice.default": "Средства сначала безопасно удерживаются UniServe и переводятся только после выполнения условий доставки или завершения услуги.",
    "checkout.trustNotice.product": "Средства безопасно удерживаются в escrow UniServe до подтверждения доставки товара.",
    "checkout.trustNotice.service": "Средства безопасно удерживаются в escrow UniServe до подтверждения завершения услуги.",
    "checkout.mixedOrderDisabled": "Смешанный checkout товаров и услуг в этой версии отключён.",
    "checkout.nextSteps.held.1": "Платёж подтверждён, средства удерживаются в escrow UniServe.",
    "checkout.nextSteps.held.2": "Продавец или агент начнёт выполнение заказа.",
    "checkout.nextSteps.held.3": "После подтверждения доставки или завершения начнётся процесс release и payout.",
    "checkout.nextSteps.smsLink.1": "По SMS отправлена безопасная платёжная ссылка или счёт.",
    "checkout.nextSteps.smsLink.2": "Пока платёж не подтверждён, заказ остаётся в статусе awaiting payment.",
    "checkout.nextSteps.smsLink.3": "Если срок ссылки истечёт, нужно создать новую платёжную сессию.",
    "checkout.nextSteps.manualTransfer.1": "Банковские реквизиты созданы, reference code прикреплён.",
    "checkout.nextSteps.manualTransfer.2": "После проверки перевода заказ перейдёт в escrow.",
    "checkout.nextSteps.manualTransfer.3": "В комментарии к переводу обязательно укажите reference code.",
    "checkout.nextSteps.pendingVerification.1": "Сигнал о платеже получен, но проверка ещё не завершена.",
    "checkout.nextSteps.pendingVerification.2": "После подтверждения средства будут переведены в escrow.",
    "checkout.nextSteps.default.1": "Статус оплаты обновляется.",
    "payment.intent.continue": "Продолжить оплату",
    "payment.intent.smsLinkSent": "SMS-ссылка отправлена",
    "payment.intent.smsInvoiceSent": "Реквизиты отправлены по SMS",
    "payment.intent.bankDetailsReady": "Реквизиты созданы",
    "payment.intent.infoReady": "Платёжные данные готовы",
    "payment.instructions.smsLink": "Откройте безопасную ссылку из SMS и завершите оплату до истечения срока.",
    "payment.instructions.smsInvoice": "Оплатите по реквизитам из SMS и сохраните квитанцию для проверки.",
    "payment.instructions.manualTransfer": "Переведите сумму вручную и укажите reference code в назначении платежа.",
    "payment.instructions.manualTransferBank": "Переведите полную сумму на указанный расчётный счёт. После проверки средства перейдут в escrow.",
    "payment.instructions.routingNote": "Укажите точный reference code в комментарии к переводу.",
    "payment.collection.ready.instant": "Онлайн-платёжная сессия готова. Завершите оплату, чтобы средства перешли в escrow UniServe.",
    "payment.collection.ready.smsLink": "Безопасная платёжная ссылка отправлена по SMS. Заказ активируется после подтверждения оплаты.",
    "payment.collection.ready.smsInvoice": "Платёжные реквизиты отправлены по SMS. Заказ активируется после подтверждения оплаты.",
    "payment.collection.ready.manualTransfer": "Банковские реквизиты созданы. Заказ активируется после проверки перевода.",
    "payment.collection.smsBody": ({ orderCode, amount, expiry, referenceCode, action }) =>
      `Заказ UniServe ${orderCode}: ${amount}. Срок действия до ${expiry}. Ref: ${referenceCode}.${action ? ` ${action}` : ""}`,
    "payment.collection.smsSecurityNote": "Из соображений безопасности не пересылайте ссылку или реквизиты другим лицам.",
    "payment.failure.expired": "Срок оплаты истёк.",
    "payment.failure.cancelled": "Платёж отменён.",
    "payment.failure.verificationFailed": "Проверка платежа не пройдена.",
    "payment.failure.intentNotFound": "Платёжный intent не найден",
    "payment.failure.smsFlowNotConfigured": "Для этого платёжного intent не настроен SMS-сценарий",
    "payment.status.awaiting_payment.buyer": "Ожидается оплата",
    "payment.status.payment_link_sent.buyer": "Платёжная ссылка отправлена",
    "payment.status.awaiting_manual_transfer.buyer": "Ожидается банковский перевод",
    "payment.status.payment_pending_verification.buyer": "Платёж проверяется",
    "payment.status.paid.buyer": "Платёж принят",
    "payment.status.held_in_escrow.buyer": "Средства безопасно удерживаются на escrow-счёте UniServe",
    "payment.status.fulfillment_started.buyer": "Заказ или услуга выполняются",
    "payment.status.delivered_or_completed.buyer": "Доставка или выполнение зафиксированы",
    "payment.status.awaiting_buyer_confirmation.buyer": "Ожидается ваше подтверждение",
    "payment.status.dispute_opened.buyer": "Спор рассматривается",
    "payment.status.refund_approved.buyer": "Возврат одобрен",
    "payment.status.release_approved.buyer": "По результатам проверки средства release в пользу продавца или агента",
    "payment.status.released_to_seller_pending_payout.buyer": "Средства переведены в pending payout продавца",
    "payment.status.payout_completed.buyer": "Процесс settlement завершён",
    "payment.status.payment_failed.buyer": "Платёж не выполнен",
    "payment.status.payment_expired.buyer": "Срок оплаты истёк",
    "payment.status.cancelled.buyer": "Заказ отменён",
    "payment.status.held_in_escrow.seller": "Платёж покупателя принят и удерживается в escrow",
    "payment.status.fulfillment_started.seller": "Можно начать выполнение заказа",
    "payment.status.delivered_or_completed.seller": "Доставка или выполнение зафиксированы",
    "payment.status.awaiting_buyer_confirmation.seller": "Ожидается подтверждение покупателя",
    "payment.status.release_approved.seller": "Средства переведены на ваш pending payout баланс",
    "payment.status.released_to_seller_pending_payout.seller": "Средства подготовлены к pending payout",
    "payment.status.payout_completed.seller": "Средства переведены на ваш счёт",
    "payment.status.cancelled.seller": "Заказ отменён",
    "payment.notification.paymentHeld.buyer": ({ sourceLabel, amount, trustCopy }) =>
      `${sourceLabel}: получено ${amount}, средства удерживаются в escrow. ${trustCopy}`,
    "payment.notification.paymentHeld.seller": ({ sourceLabel }) =>
      `${sourceLabel}: платёж покупателя принят. Средства хранятся в escrow до подтверждения доставки или завершения.`,
    "payment.notification.awaitingReview.buyer": ({ sourceLabel, reviewWindow }) =>
      `${sourceLabel}: доставка или выполнение зафиксированы. Если возражений нет, средства будут переведены продавцу после review window.${reviewWindow ? ` ${reviewWindow}` : ""}`,
    "payment.notification.awaitingReview.seller": ({ sourceLabel }) =>
      `${sourceLabel}: доставка или выполнение зафиксированы. После окончания review window или подтверждения покупателя средства перейдут в pending payout.`,
    "payment.notification.release.buyer": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: по итогам review или dispute ${amount} переведены продавцу. Причина: ${reason}`,
    "payment.notification.release.seller": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: ${amount} переведены на ваш pending payout баланс. Причина: ${reason}`,
    "payment.notification.refundApproved.buyer": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: возврат ${amount} одобрен. Причина: ${reason}`,
    "payment.notification.refundDenied.buyer": ({ sourceLabel, reason }) =>
      `${sourceLabel}: в возврате отказано. Средства будут переведены продавцу. Причина: ${reason}`,
    "payment.notification.refundApproved.seller": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: по решению спора ${amount} возвращаются покупателю. Причина: ${reason}`,
    "payment.notification.refundDenied.seller": ({ sourceLabel, reason }) =>
      `${sourceLabel}: по решению спора средства будут переведены на ваш pending payout баланс. Причина: ${reason}`,
    "payment.notification.payoutStatus": ({ status, amount, reason }) =>
      `Выплата ${status}: ${amount}.${reason ? ` Причина: ${reason}` : ""}`,
    "payment.method.card.name": "Карта",
    "payment.method.card.description": "Мгновенная онлайн-оплата картой через escrow UniServe.",
    "payment.method.payme.name": "Payme",
    "payment.method.payme.description": "Продолжите через Payme, средства будут удержаны в escrow UniServe после подтверждения.",
    "payment.method.click.name": "Click",
    "payment.method.click.description": "Перейдите в Click и подтвердите оплату с возвратом средств в escrow UniServe.",
    "payment.method.kakaopay.name": "KakaoPay",
    "payment.method.kakaopay.description": "Быстрый wallet-платёж через escrow под управлением UniServe.",
    "payment.method.sms_payment_link.name": "SMS-платёжная ссылка",
    "payment.method.sms_payment_link.description": "Отправляет безопасную платёжную ссылку на телефон покупателя и активирует заказ после подтверждения.",
    "payment.method.sms_invoice.name": "SMS-счёт",
    "payment.method.sms_invoice.description": "Отправляет реквизиты и reference code по SMS для последующей оплаты.",
    "payment.method.manual_bank_transfer.name": "Ручной банковский перевод",
    "payment.method.manual_bank_transfer.description": "Показывает банковские реквизиты и удерживает заказ до завершения проверки перевода.",
    "payment.method.future_psp.name": "Будущий PSP",
    "payment.method.future_psp.description": "Резервный современный способ оплаты для будущих PSP-интеграций.",
    "dispute.default.buyerOpened": "Покупатель открыл спор.",
    "dispute.default.sellerResponded": "Продавец ответил по спору."
  },
  en: {
    "common.auth.authorizationHeaderMissing": "Authorization header missing",
    "common.auth.invalidOrExpiredToken": "Invalid or expired token",
    "common.auth.notAuthenticated": "Not authenticated",
    "common.auth.adminSessionRequired": "Admin session required",
    "common.auth.adminSessionInvalid": "Admin session is invalid or revoked",
    "common.auth.adminAccessRequired": "Admin access required",
    "common.errors.forbidden": "Forbidden",
    "common.errors.server": "Server error",
    "common.notFound.order": "Order not found",
    "common.notFound.serviceOrder": "Service order not found",
    "common.notFound.service": "Service not found",
    "common.notFound.dispute": "Dispute not found",
    "common.notFound.paymentIntent": "Payment intent not found",
    "common.notFound.smsRequest": "SMS request not found",
    "common.notFound.serviceOwner": "Service owner not found",
    "common.validation.invalidOrderId": "Invalid order id",
    "common.validation.invalidDisputeId": "Invalid dispute id",
    "common.validation.validSourceIdRequired": "Valid sourceId is required",
    "common.validation.validPaymentOrOrderRequired": "Valid paymentId or orderId is required",
    "common.validation.messageRequired": "message is required",
    "common.validation.descriptionOrFileUrlRequired": "description or fileUrl is required",
    "common.validation.customerFieldsRequired": "customerName, customerPhone, customerAddress are required",
    "common.validation.reactionMustBeLikeOrDislike": "reaction must be like or dislike",
    "common.validation.ownServiceOrderNotAllowed": "You cannot order your own service",
    "checkout.trustNotice.default": "Funds are held securely by UniServe first and released only after delivery or completion rules are met.",
    "checkout.trustNotice.product": "Funds are held securely in UniServe escrow until product delivery is confirmed.",
    "checkout.trustNotice.service": "Funds are held securely in UniServe escrow until service completion is confirmed.",
    "checkout.mixedOrderDisabled": "Mixed product and service checkout is not enabled in this release.",
    "checkout.nextSteps.held.1": "Payment is confirmed and funds are held in UniServe escrow.",
    "checkout.nextSteps.held.2": "The seller or agent will start fulfillment.",
    "checkout.nextSteps.held.3": "The release and payout flow starts after delivery or completion is confirmed.",
    "checkout.nextSteps.smsLink.1": "A secure payment link or invoice was sent by SMS.",
    "checkout.nextSteps.smsLink.2": "The order remains awaiting payment until the payment is confirmed.",
    "checkout.nextSteps.smsLink.3": "If the link expires, a new payment session must be created.",
    "checkout.nextSteps.manualTransfer.1": "Bank requisites were generated and a reference code was attached.",
    "checkout.nextSteps.manualTransfer.2": "The order moves into escrow after the transfer is verified.",
    "checkout.nextSteps.manualTransfer.3": "The reference code must be included in the transfer memo.",
    "checkout.nextSteps.pendingVerification.1": "A payment signal was received, but verification is still pending.",
    "checkout.nextSteps.pendingVerification.2": "Funds will move into escrow after confirmation.",
    "checkout.nextSteps.default.1": "Payment status is being updated.",
    "payment.intent.continue": "Continue payment",
    "payment.intent.smsLinkSent": "SMS link sent",
    "payment.intent.smsInvoiceSent": "SMS requisites sent",
    "payment.intent.bankDetailsReady": "Bank details generated",
    "payment.intent.infoReady": "Payment information ready",
    "payment.instructions.smsLink": "Open the secure payment link from SMS and complete payment before expiry.",
    "payment.instructions.smsInvoice": "Pay using the SMS requisites and keep the receipt for verification.",
    "payment.instructions.manualTransfer": "Transfer the amount manually and use the reference code in the memo.",
    "payment.instructions.manualTransferBank": "Transfer the full amount to the listed settlement account. Funds move into escrow after verification.",
    "payment.instructions.routingNote": "Use the exact reference code in the transfer memo.",
    "payment.collection.ready.instant": "Online payment session is ready. Complete payment to move funds into UniServe escrow.",
    "payment.collection.ready.smsLink": "A secure payment link was sent by SMS. The order activates after payment confirmation.",
    "payment.collection.ready.smsInvoice": "Invoice requisites were sent by SMS. The order activates after payment confirmation.",
    "payment.collection.ready.manualTransfer": "Bank transfer requisites were generated. The order activates after transfer verification.",
    "payment.collection.smsBody": ({ orderCode, amount, expiry, referenceCode, action }) =>
      `UniServe order ${orderCode}: ${amount}. Expires ${expiry}. Ref: ${referenceCode}.${action ? ` ${action}` : ""}`,
    "payment.collection.smsSecurityNote": "For safety, do not share this link or payment instruction with anyone else.",
    "payment.failure.expired": "Payment window expired.",
    "payment.failure.cancelled": "Payment cancelled.",
    "payment.failure.verificationFailed": "Payment verification failed.",
    "payment.failure.intentNotFound": "Payment intent not found",
    "payment.failure.smsFlowNotConfigured": "SMS flow is not configured for this payment intent",
    "payment.status.awaiting_payment.buyer": "Awaiting payment",
    "payment.status.payment_link_sent.buyer": "Payment link sent",
    "payment.status.awaiting_manual_transfer.buyer": "Awaiting manual transfer",
    "payment.status.payment_pending_verification.buyer": "Payment pending verification",
    "payment.status.paid.buyer": "Payment received",
    "payment.status.held_in_escrow.buyer": "Funds are being held securely in UniServe escrow",
    "payment.status.fulfillment_started.buyer": "Order or service is in progress",
    "payment.status.delivered_or_completed.buyer": "Delivery or completion recorded",
    "payment.status.awaiting_buyer_confirmation.buyer": "Awaiting your confirmation",
    "payment.status.dispute_opened.buyer": "Dispute is under review",
    "payment.status.refund_approved.buyer": "Refund approved",
    "payment.status.release_approved.buyer": "Funds were released to the seller or agent after review",
    "payment.status.released_to_seller_pending_payout.buyer": "Funds were moved to the seller pending payout balance",
    "payment.status.payout_completed.buyer": "Settlement completed",
    "payment.status.payment_failed.buyer": "Payment failed",
    "payment.status.payment_expired.buyer": "Payment expired",
    "payment.status.cancelled.buyer": "Order cancelled",
    "payment.status.held_in_escrow.seller": "Buyer payment was received and is held in escrow",
    "payment.status.fulfillment_started.seller": "You can start fulfilling this order",
    "payment.status.delivered_or_completed.seller": "Delivery or completion recorded",
    "payment.status.awaiting_buyer_confirmation.seller": "Awaiting buyer confirmation",
    "payment.status.release_approved.seller": "Funds were moved to your pending payout balance",
    "payment.status.released_to_seller_pending_payout.seller": "Funds are ready in pending payout",
    "payment.status.payout_completed.seller": "Payout was transferred to your account",
    "payment.status.cancelled.seller": "Order cancelled",
    "payment.notification.paymentHeld.buyer": ({ sourceLabel, amount, trustCopy }) =>
      `${sourceLabel}: ${amount} was received and placed in escrow. ${trustCopy}`,
    "payment.notification.paymentHeld.seller": ({ sourceLabel }) =>
      `${sourceLabel}: buyer payment was received. Funds remain in escrow until delivery or completion is confirmed.`,
    "payment.notification.awaitingReview.buyer": ({ sourceLabel, reviewWindow }) =>
      `${sourceLabel}: delivery or completion was recorded. If there is no dispute, funds will be released to the seller after the review window.${reviewWindow ? ` ${reviewWindow}` : ""}`,
    "payment.notification.awaitingReview.seller": ({ sourceLabel }) =>
      `${sourceLabel}: delivery or completion was recorded. Funds move to your pending payout balance after buyer confirmation or the review window ends.`,
    "payment.notification.release.buyer": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: ${amount} was released to the seller after review or dispute handling. Reason: ${reason}`,
    "payment.notification.release.seller": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: ${amount} was moved to your pending payout balance. Reason: ${reason}`,
    "payment.notification.refundApproved.buyer": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: refund of ${amount} was approved. Reason: ${reason}`,
    "payment.notification.refundDenied.buyer": ({ sourceLabel, reason }) =>
      `${sourceLabel}: refund request was denied. Funds will be released to the seller. Reason: ${reason}`,
    "payment.notification.refundApproved.seller": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: ${amount} will be refunded to the buyer under the dispute decision. Reason: ${reason}`,
    "payment.notification.refundDenied.seller": ({ sourceLabel, reason }) =>
      `${sourceLabel}: funds will be moved to your pending payout balance under the dispute decision. Reason: ${reason}`,
    "payment.notification.payoutStatus": ({ status, amount, reason }) =>
      `Payout ${status}: ${amount}.${reason ? ` Reason: ${reason}` : ""}`,
    "payment.method.card.name": "Card",
    "payment.method.card.description": "Instant online card payment routed through UniServe escrow.",
    "payment.method.payme.name": "Payme",
    "payment.method.payme.description": "Continue through Payme and hold funds in UniServe escrow after confirmation.",
    "payment.method.click.name": "Click",
    "payment.method.click.description": "Redirect to Click and confirm the payment back into UniServe escrow.",
    "payment.method.kakaopay.name": "KakaoPay",
    "payment.method.kakaopay.description": "Fast wallet payment routed through UniServe-controlled escrow.",
    "payment.method.sms_payment_link.name": "SMS payment link",
    "payment.method.sms_payment_link.description": "Send a secure payment link to the buyer phone and activate after payment confirmation.",
    "payment.method.sms_invoice.name": "SMS invoice",
    "payment.method.sms_invoice.description": "Send invoice requisites and reference code over SMS for later payment.",
    "payment.method.manual_bank_transfer.name": "Manual bank transfer",
    "payment.method.manual_bank_transfer.description": "Show bank requisites and hold the order until transfer verification completes.",
    "payment.method.future_psp.name": "Future PSP",
    "payment.method.future_psp.description": "Reserved modern payment option for future PSP integrations.",
    "dispute.default.buyerOpened": "Buyer opened a dispute.",
    "dispute.default.sellerResponded": "Seller responded to the dispute."
  },
  ko: {
    "common.auth.authorizationHeaderMissing": "Authorization 헤더가 없습니다",
    "common.auth.invalidOrExpiredToken": "토큰이 유효하지 않거나 만료되었습니다",
    "common.auth.notAuthenticated": "인증이 필요합니다",
    "common.auth.adminSessionRequired": "관리자 세션이 필요합니다",
    "common.auth.adminSessionInvalid": "관리자 세션이 유효하지 않거나 취소되었습니다",
    "common.auth.adminAccessRequired": "관리자 권한이 필요합니다",
    "common.errors.forbidden": "이 작업을 수행할 권한이 없습니다",
    "common.errors.server": "서버 오류",
    "common.notFound.order": "주문을 찾을 수 없습니다",
    "common.notFound.serviceOrder": "서비스 주문을 찾을 수 없습니다",
    "common.notFound.service": "서비스를 찾을 수 없습니다",
    "common.notFound.dispute": "분쟁을 찾을 수 없습니다",
    "common.notFound.paymentIntent": "결제 intent를 찾을 수 없습니다",
    "common.notFound.smsRequest": "SMS 요청을 찾을 수 없습니다",
    "common.notFound.serviceOwner": "서비스 제공자를 찾을 수 없습니다",
    "common.validation.invalidOrderId": "잘못된 주문 ID입니다",
    "common.validation.invalidDisputeId": "잘못된 분쟁 ID입니다",
    "common.validation.validSourceIdRequired": "유효한 sourceId가 필요합니다",
    "common.validation.validPaymentOrOrderRequired": "유효한 paymentId 또는 orderId가 필요합니다",
    "common.validation.messageRequired": "메시지는 필수입니다",
    "common.validation.descriptionOrFileUrlRequired": "description 또는 fileUrl이 필요합니다",
    "common.validation.customerFieldsRequired": "customerName, customerPhone, customerAddress는 필수입니다",
    "common.validation.reactionMustBeLikeOrDislike": "reaction은 like 또는 dislike여야 합니다",
    "common.validation.ownServiceOrderNotAllowed": "본인 서비스를 주문할 수 없습니다",
    "checkout.trustNotice.default": "자금은 먼저 UniServe가 안전하게 보관하며, 배송 또는 완료 규칙이 충족된 후에만 정산됩니다.",
    "checkout.trustNotice.product": "상품 배송이 확인될 때까지 자금은 UniServe 에스크로에 안전하게 보관됩니다.",
    "checkout.trustNotice.service": "서비스 완료가 확인될 때까지 자금은 UniServe 에스크로에 안전하게 보관됩니다.",
    "checkout.mixedOrderDisabled": "이 릴리스에서는 상품과 서비스 혼합 체크아웃이 지원되지 않습니다.",
    "checkout.nextSteps.held.1": "결제가 확인되었고 자금은 UniServe 에스크로에 보관됩니다.",
    "checkout.nextSteps.held.2": "판매자 또는 에이전트가 이행을 시작합니다.",
    "checkout.nextSteps.held.3": "배송 또는 완료가 확인되면 release 및 payout 절차가 시작됩니다.",
    "checkout.nextSteps.smsLink.1": "보안 결제 링크 또는 청구서가 SMS로 전송되었습니다.",
    "checkout.nextSteps.smsLink.2": "결제가 확인될 때까지 주문은 결제 대기 상태로 유지됩니다.",
    "checkout.nextSteps.smsLink.3": "링크가 만료되면 새 결제 세션을 만들어야 합니다.",
    "checkout.nextSteps.manualTransfer.1": "은행 송금 정보가 생성되었고 reference code가 연결되었습니다.",
    "checkout.nextSteps.manualTransfer.2": "송금 확인 후 주문이 에스크로로 이동합니다.",
    "checkout.nextSteps.manualTransfer.3": "송금 메모에 reference code를 반드시 포함해야 합니다.",
    "checkout.nextSteps.pendingVerification.1": "결제 신호는 수신되었지만 아직 검증이 끝나지 않았습니다.",
    "checkout.nextSteps.pendingVerification.2": "확인 후 자금이 에스크로로 이동합니다.",
    "checkout.nextSteps.default.1": "결제 상태를 업데이트하는 중입니다.",
    "payment.intent.continue": "결제 계속하기",
    "payment.intent.smsLinkSent": "SMS 링크 전송됨",
    "payment.intent.smsInvoiceSent": "SMS 송금 정보 전송됨",
    "payment.intent.bankDetailsReady": "은행 정보 생성됨",
    "payment.intent.infoReady": "결제 정보 준비됨",
    "payment.instructions.smsLink": "SMS의 보안 링크를 열고 만료 전에 결제를 완료하세요.",
    "payment.instructions.smsInvoice": "SMS로 받은 송금 정보로 결제하고 검증을 위해 영수증을 보관하세요.",
    "payment.instructions.manualTransfer": "수동으로 송금하고 메모에 reference code를 적어 주세요.",
    "payment.instructions.manualTransferBank": "안내된 정산 계좌로 전체 금액을 송금하세요. 검증 후 자금이 에스크로로 이동합니다.",
    "payment.instructions.routingNote": "송금 메모에 정확한 reference code를 입력하세요.",
    "payment.collection.ready.instant": "온라인 결제 세션이 준비되었습니다. 자금이 UniServe 에스크로로 이동하도록 결제를 완료하세요.",
    "payment.collection.ready.smsLink": "보안 결제 링크가 SMS로 전송되었습니다. 결제 확인 후 주문이 활성화됩니다.",
    "payment.collection.ready.smsInvoice": "청구서 송금 정보가 SMS로 전송되었습니다. 결제 확인 후 주문이 활성화됩니다.",
    "payment.collection.ready.manualTransfer": "은행 송금 정보가 생성되었습니다. 송금 검증 후 주문이 활성화됩니다.",
    "payment.collection.smsBody": ({ orderCode, amount, expiry, referenceCode, action }) =>
      `UniServe 주문 ${orderCode}: ${amount}. 만료 ${expiry}. Ref: ${referenceCode}.${action ? ` ${action}` : ""}`,
    "payment.collection.smsSecurityNote": "보안을 위해 이 링크나 결제 정보를 다른 사람과 공유하지 마세요.",
    "payment.failure.expired": "결제 가능 시간이 만료되었습니다.",
    "payment.failure.cancelled": "결제가 취소되었습니다.",
    "payment.failure.verificationFailed": "결제 검증에 실패했습니다.",
    "payment.failure.intentNotFound": "결제 intent를 찾을 수 없습니다",
    "payment.failure.smsFlowNotConfigured": "이 결제 intent에는 SMS 흐름이 설정되어 있지 않습니다",
    "payment.status.awaiting_payment.buyer": "결제 대기 중",
    "payment.status.payment_link_sent.buyer": "결제 링크 전송됨",
    "payment.status.awaiting_manual_transfer.buyer": "수동 송금 대기 중",
    "payment.status.payment_pending_verification.buyer": "결제 검증 대기 중",
    "payment.status.paid.buyer": "결제가 접수되었습니다",
    "payment.status.held_in_escrow.buyer": "자금이 UniServe 에스크로에 안전하게 보관되고 있습니다",
    "payment.status.fulfillment_started.buyer": "주문 또는 서비스가 진행 중입니다",
    "payment.status.delivered_or_completed.buyer": "배송 또는 완료가 기록되었습니다",
    "payment.status.awaiting_buyer_confirmation.buyer": "구매자 확인을 기다리는 중입니다",
    "payment.status.dispute_opened.buyer": "분쟁이 검토 중입니다",
    "payment.status.refund_approved.buyer": "환불 승인됨",
    "payment.status.release_approved.buyer": "검토 결과 자금이 판매자 또는 에이전트에게 release되었습니다",
    "payment.status.released_to_seller_pending_payout.buyer": "자금이 판매자 pending payout 잔액으로 이동되었습니다",
    "payment.status.payout_completed.buyer": "정산이 완료되었습니다",
    "payment.status.payment_failed.buyer": "결제 실패",
    "payment.status.payment_expired.buyer": "결제 만료",
    "payment.status.cancelled.buyer": "주문 취소됨",
    "payment.status.held_in_escrow.seller": "구매자 결제가 접수되었고 에스크로에 보관 중입니다",
    "payment.status.fulfillment_started.seller": "주문 이행을 시작할 수 있습니다",
    "payment.status.delivered_or_completed.seller": "배송 또는 완료가 기록되었습니다",
    "payment.status.awaiting_buyer_confirmation.seller": "구매자 확인을 기다리는 중입니다",
    "payment.status.release_approved.seller": "자금이 pending payout 잔액으로 이동되었습니다",
    "payment.status.released_to_seller_pending_payout.seller": "자금이 pending payout에 준비되었습니다",
    "payment.status.payout_completed.seller": "지급금이 계좌로 이체되었습니다",
    "payment.status.cancelled.seller": "주문 취소됨",
    "payment.notification.paymentHeld.buyer": ({ sourceLabel, amount, trustCopy }) =>
      `${sourceLabel}: ${amount} 결제가 접수되어 에스크로에 보관되었습니다. ${trustCopy}`,
    "payment.notification.paymentHeld.seller": ({ sourceLabel }) =>
      `${sourceLabel}: 구매자 결제가 접수되었습니다. 배송 또는 완료 확인 전까지 자금은 에스크로에 보관됩니다.`,
    "payment.notification.awaitingReview.buyer": ({ sourceLabel, reviewWindow }) =>
      `${sourceLabel}: 배송 또는 완료가 기록되었습니다. 분쟁이 없으면 리뷰 기간 후 자금이 판매자에게 release됩니다.${reviewWindow ? ` ${reviewWindow}` : ""}`,
    "payment.notification.awaitingReview.seller": ({ sourceLabel }) =>
      `${sourceLabel}: 배송 또는 완료가 기록되었습니다. 구매자 확인 또는 리뷰 기간 종료 후 자금이 pending payout으로 이동합니다.`,
    "payment.notification.release.buyer": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: 검토 또는 분쟁 처리 결과 ${amount}가 판매자에게 release되었습니다. 사유: ${reason}`,
    "payment.notification.release.seller": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: ${amount}가 pending payout 잔액으로 이동되었습니다. 사유: ${reason}`,
    "payment.notification.refundApproved.buyer": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: ${amount} 환불이 승인되었습니다. 사유: ${reason}`,
    "payment.notification.refundDenied.buyer": ({ sourceLabel, reason }) =>
      `${sourceLabel}: 환불 요청이 거절되었습니다. 자금은 판매자에게 release됩니다. 사유: ${reason}`,
    "payment.notification.refundApproved.seller": ({ sourceLabel, amount, reason }) =>
      `${sourceLabel}: 분쟁 결정에 따라 ${amount}가 구매자에게 환불됩니다. 사유: ${reason}`,
    "payment.notification.refundDenied.seller": ({ sourceLabel, reason }) =>
      `${sourceLabel}: 분쟁 결정에 따라 자금이 pending payout 잔액으로 이동됩니다. 사유: ${reason}`,
    "payment.notification.payoutStatus": ({ status, amount, reason }) =>
      `지급 ${status}: ${amount}.${reason ? ` 사유: ${reason}` : ""}`,
    "payment.method.card.name": "카드",
    "payment.method.card.description": "UniServe 에스크로를 통한 즉시 온라인 카드 결제입니다.",
    "payment.method.payme.name": "Payme",
    "payment.method.payme.description": "Payme로 진행하며 확인 후 자금은 UniServe 에스크로에 보관됩니다.",
    "payment.method.click.name": "Click",
    "payment.method.click.description": "Click으로 이동해 결제를 완료하면 자금이 UniServe 에스크로로 돌아옵니다.",
    "payment.method.kakaopay.name": "KakaoPay",
    "payment.method.kakaopay.description": "UniServe가 제어하는 에스크로를 통한 빠른 지갑 결제입니다.",
    "payment.method.sms_payment_link.name": "SMS 결제 링크",
    "payment.method.sms_payment_link.description": "구매자 전화번호로 보안 결제 링크를 보내고 결제 확인 후 주문을 활성화합니다.",
    "payment.method.sms_invoice.name": "SMS 청구서",
    "payment.method.sms_invoice.description": "나중에 결제할 수 있도록 송금 정보와 reference code를 SMS로 전송합니다.",
    "payment.method.manual_bank_transfer.name": "수동 은행 송금",
    "payment.method.manual_bank_transfer.description": "은행 송금 정보를 보여주고 송금 검증이 끝날 때까지 주문을 보류합니다.",
    "payment.method.future_psp.name": "향후 PSP",
    "payment.method.future_psp.description": "향후 PSP 연동을 위한 예비 현대 결제 수단입니다.",
    "dispute.default.buyerOpened": "구매자가 분쟁을 열었습니다.",
    "dispute.default.sellerResponded": "판매자가 분쟁에 응답했습니다."
  }
};

const missingTranslationWarnings = new Set<string>();

const resolveMessageKey = (key: string) => STANDARD_MESSAGE_ALIASES[key] || key;

const readMessage = (locale: AppLocale, key: string): MessageResolver | undefined =>
  STANDARD_MESSAGES[locale]?.[key] ??
  messages[locale]?.[key];

const humanizeKey = (key: string) =>
  key
    .split(".")
    .pop()
    ?.replace(/[_-]+/g, " ")
    .trim() || "Unavailable";

const warnMissingTranslation = (locale: AppLocale, key: string, resolvedKey: string) => {
  if (process.env.NODE_ENV === "production") return;
  const warningKey = `${locale}:${key}:${resolvedKey}`;
  if (missingTranslationWarnings.has(warningKey)) return;
  missingTranslationWarnings.add(warningKey);
  console.warn(`[i18n] Missing translation for "${key}" in locale "${locale}". Fallback key: "${resolvedKey}".`);
};

export const resolveLocale = (value?: unknown): AppLocale => {
  const raw = String(Array.isArray(value) ? value[0] : value || "").trim().toLowerCase();
  if (!raw) return DEFAULT_LOCALE;
  if (SUPPORTED_LOCALES.includes(raw as AppLocale)) return raw as AppLocale;
  const tag = raw.split(",")[0]?.split(";")[0]?.trim() || "";
  const base = tag.split("-")[0]?.trim() || "";
  if (SUPPORTED_LOCALES.includes(base as AppLocale)) return base as AppLocale;
  return DEFAULT_LOCALE;
};

const pickLocaleHint = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string" && entry.trim());
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
};

export const resolveRequestLocale = (
  req?: (Pick<Request, "locale" | "headers"> & { query?: Request["query"]; cookies?: Record<string, unknown> }) | null
): AppLocale => {
  if (req?.locale && SUPPORTED_LOCALES.includes(req.locale as AppLocale)) {
    return req.locale as AppLocale;
  }
  const explicit =
    pickLocaleHint(req?.query?.locale) ||
    pickLocaleHint(req?.query?.lang) ||
    pickLocaleHint(req?.headers?.["x-locale"]) ||
    pickLocaleHint(req?.cookies?.locale) ||
    pickLocaleHint(req?.cookies?.lang) ||
    pickLocaleHint(req?.headers?.["accept-language"]);
  return resolveLocale(explicit);
};

export const translate = (
  locale: AppLocale | undefined,
  key: MessageKey,
  params: Record<string, string | number | null | undefined> = {}
) => {
  const resolvedLocale = locale || DEFAULT_LOCALE;
  const resolvedKey = resolveMessageKey(key);
  const directResolver = readMessage(resolvedLocale, key);
  const aliasedResolver = key === resolvedKey ? undefined : readMessage(resolvedLocale, resolvedKey);
  const fallbackResolver =
    readMessage(DEFAULT_LOCALE, key) ??
    (key === resolvedKey ? undefined : readMessage(DEFAULT_LOCALE, resolvedKey)) ??
    readMessage("en", key) ??
    (key === resolvedKey ? undefined : readMessage("en", resolvedKey));
  const resolver = directResolver ?? aliasedResolver ?? fallbackResolver;
  if (!resolver) {
    warnMissingTranslation(resolvedLocale, key, resolvedKey);
    return humanizeKey(key);
  }
  if (!directResolver && !aliasedResolver) {
    warnMissingTranslation(resolvedLocale, key, resolvedKey);
  }
  if (typeof resolver === "function") return resolver(params, resolvedLocale);
  return interpolate(resolver, params);
};

export const t = (
  reqOrLocale: Pick<Request, "locale" | "headers"> | AppLocale | null | undefined,
  key: MessageKey,
  params: Record<string, string | number | null | undefined> = {}
) => {
  const locale =
    typeof reqOrLocale === "string" || !reqOrLocale
      ? resolveLocale(reqOrLocale)
      : resolveRequestLocale(reqOrLocale);
  return translate(locale, key, params);
};

export const formatCurrencyForLocale = (amount: number, currency = "USD", locale?: AppLocale) =>
  new Intl.NumberFormat(localeTags[locale || DEFAULT_LOCALE], {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);

export const formatDateTimeForLocale = (value: Date | string | number, locale?: AppLocale) =>
  new Intl.DateTimeFormat(localeTags[locale || DEFAULT_LOCALE], {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export const formatReviewWindowSuffix = (date?: Date | string | null, locale?: AppLocale) => {
  if (!date) return "";
  const label =
    locale === "ru"
      ? "Окно проверки до"
      : locale === "en"
        ? "Review window until"
        : locale === "ko"
          ? "검토 기간 종료"
          : "Review window";
  return `${label}: ${formatDateTimeForLocale(date, locale)}.`;
};
