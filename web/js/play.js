/* Sonrisas · pagos con Google Play.
   Solo funcionan dentro de la app que se instala desde Play Store (Trusted Web Activity con Play Billing).
   - Detecta la app de Play: abre Sonrisas con ?origen=play (start_url del paquete) o con referrer android-app://.
   - Muestra los planes con el precio que pone Google (Digital Goods API) y cobra con su ventana de pago (Payment Request).
   - Cada compra la verifica la función del servidor con Google antes de extender la suscripción: la página nunca
     activa nada por su cuenta.
   En la app de Play no se muestran los otros métodos de pago (Pago Móvil, PayPal…): Google no lo permite. */
(function () {
  const PLAY_BILLING = 'https://play.google.com/billing';
  const FLAG = 'sonrisas-play';

  const detect = () => {
    const fromPlay = new URLSearchParams(location.search).get('origen') === 'play' || document.referrer.startsWith('android-app://');
    try {
      if (fromPlay) localStorage.setItem(FLAG, '1');
      return fromPlay || localStorage.getItem(FLAG) === '1';
    } catch {
      return fromPlay;
    }
  };
  const inPlayApp = detect();

  let servicePromise = null;
  /** El servicio de Google Play, o null fuera de la app de Play (o si el paquete no tiene pagos activados). */
  const service = () => {
    if (!inPlayApp || !('getDigitalGoodsService' in window)) return Promise.resolve(null);
    if (!servicePromise) servicePromise = window.getDigitalGoodsService(PLAY_BILLING).catch(() => null);
    return servicePromise;
  };
  const available = async () => !!(await service());

  /** Nombre y precio de cada plan tal como los configuraste en Play Console. */
  const details = async (skus) => {
    const s = await service();
    const ids = skus.filter(Boolean);
    if (!s || !ids.length) return [];
    try { return await s.getDetails(ids); } catch { return []; }
  };
  const priceText = (item) => {
    try {
      return new Intl.NumberFormat('es-VE', { style: 'currency', currency: item.price.currency }).format(Number(item.price.value));
    } catch {
      return `${item.price.value} ${item.price.currency}`;
    }
  };

  const verify = (productId, purchaseToken) => Session.api('play_verify', { productId, purchaseToken });

  /** Abre la ventana de pago de Google. Devuelve lo que respondió el servidor, o null si la persona la cerró. */
  const buy = async (sku) => {
    if (!(await service())) throw new Error('Los pagos con Google Play no están disponibles en este momento. Intenta de nuevo más tarde.');
    const request = new PaymentRequest(
      [{ supportedMethods: PLAY_BILLING, data: { sku } }],
      { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } }, // Google pone el precio real
    );
    let response;
    try {
      response = await request.show();
    } catch (err) {
      if (err && err.name === 'AbortError') return null;
      throw new Error('No se pudo abrir el pago de Google Play. Intenta de nuevo.');
    }
    const { purchaseToken } = response.details || {};
    try {
      const result = await verify(sku, purchaseToken);
      await response.complete('success');
      return result;
    } catch (err) {
      try { await response.complete('fail'); } catch { /* la ventana ya se cerró */ }
      throw err;
    }
  };

  /** Vuelve a verificar las compras activas (renovaciones, o una compra que no se terminó de registrar).
      Devuelve true si la suscripción cambió. */
  const sync = async () => {
    const s = await service();
    if (!s) return false;
    let list = [];
    try { list = await s.listPurchases(); } catch { return false; }
    let changed = false;
    for (const purchase of list) {
      try {
        const result = await verify(purchase.itemId, purchase.purchaseToken);
        if (result && result.changed) changed = true;
      } catch { /* se reintenta la próxima vez que se abra la app */ }
    }
    return changed;
  };

  window.Play = { inPlayApp, available, details, priceText, buy, sync };
})();
