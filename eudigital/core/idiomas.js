/* Idiomas de las páginas de los negocios: español (el original), inglés, portugués e italiano.
   - El idioma sale del enlace (?lang=en), de lo que la persona eligió antes en su teléfono, o del
     idioma de su teléfono (si el teléfono tiene español en su lista, se queda en español).
   - Los textos fijos (botones, avisos, horario, pago, delivery…) se traducen con el diccionario de
     abajo. Se traducen solos, también lo que aparece después (el carrito, los avisos, el mapa): se
     busca cada texto tal cual en el diccionario, o en los patrones (textos con números o nombres).
   - Lo que escribe el dueño (productos, categorías) sale traducido si él llenó "En otros idiomas"
     en su panel (campo i18n de cada elemento). Si no, sale como lo escribió.
   - El mensaje de WhatsApp al negocio queda en español, con una nota del idioma del cliente.
   Para agregar un texto nuevo: ponlo en D con sus tres traducciones [inglés, portugués, italiano]. */
(function () {
  "use strict";
  const EU = (window.EU = window.EU || {});
  const LISTA = [
    { id: "es", nombre: "Español", locale: "es-VE", enEspanol: "español" },
    { id: "en", nombre: "English", locale: "en-US", enEspanol: "inglés" },
    { id: "pt", nombre: "Português", locale: "pt-BR", enEspanol: "portugués" },
    { id: "it", nombre: "Italiano", locale: "it-IT", enEspanol: "italiano" },
  ];
  const COL = { en: 0, pt: 1, it: 2 };
  const valido = (x) => LISTA.some((l) => l.id === x);

  /* ---------- Qué idioma ---------- */
  const params = new URLSearchParams(location.search);
  const enPanel = params.get("vista") === "borrador";
  let id = String(params.get("lang") || "").slice(0, 2).toLowerCase();
  if (valido(id)) { try { localStorage.setItem("eu:idioma", id); } catch (_) { /* sin almacenamiento */ } }
  else if (enPanel) id = "es"; // la vista previa del panel, en español
  else {
    try { id = localStorage.getItem("eu:idioma") || ""; } catch (_) { id = ""; }
    if (!valido(id)) {
      const tel = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "es"]).map((x) => String(x).slice(0, 2).toLowerCase());
      id = tel.includes("es") ? "es" : tel.find(valido) || "es";
    }
  }
  EU.idioma = id;
  EU.idiomas = LISTA;
  EU.idiomaInfo = LISTA.find((l) => l.id === id);
  document.documentElement.lang = id;

  /* ---------- Diccionario: "texto en español": [inglés, portugués, italiano] ---------- */
  const D = {
    // Pedido y carrito
    "Agregar al pedido": ["Add to order", "Adicionar ao pedido", "Aggiungi all'ordine"],
    "Agregar": ["Add", "Adicionar", "Aggiungi"],
    "Agregar al carrito": ["Add to cart", "Adicionar ao carrinho", "Aggiungi al carrello"],
    "Agregar arepa": ["Add arepa", "Adicionar arepa", "Aggiungi arepa"],
    "Agregado al pedido": ["Added to your order", "Adicionado ao pedido", "Aggiunto all'ordine"],
    "Agotado por hoy": ["Sold out today", "Esgotado hoje", "Esaurito per oggi"],
    "Agotada": ["Sold out", "Esgotada", "Esaurita"],
    "Agotado": ["Sold out", "Esgotado", "Esaurito"],
    "Agotada por ahora": ["Sold out for now", "Esgotada por enquanto", "Esaurita per ora"],
    "Sin precio todavía": ["No price yet", "Ainda sem preço", "Prezzo non ancora disponibile"],
    "Precio por confirmar": ["Price to be confirmed", "Preço a confirmar", "Prezzo da confermare"],
    "Tu pedido": ["Your order", "Seu pedido", "Il tuo ordine"],
    "Tu pedido (": ["Your order (", "Seu pedido (", "Il tuo ordine ("],
    "Ver pedido (": ["View order (", "Ver pedido (", "Vedi ordine ("],
    "Ver mi pedido": ["View my order", "Ver meu pedido", "Vedi il mio ordine"],
    "Ver pedido": ["View order", "Ver pedido", "Vedi ordine"],
    "Ver carrito": ["View cart", "Ver carrinho", "Vedi carrello"],
    "Tu carrito": ["Your cart", "Seu carrinho", "Il tuo carrello"],
    "Carrito": ["Cart", "Carrinho", "Carrello"],
    "Tu carrito está vacío.": ["Your cart is empty.", "Seu carrinho está vazio.", "Il tuo carrello è vuoto."],
    "Tu carrito está vacío. Agrega algo del menú.": ["Your cart is empty. Add something from the menu.", "Seu carrinho está vazio. Adicione algo do cardápio.", "Il carrello è vuoto. Aggiungi qualcosa dal menù."],
    "Aún no hay productos. Elige algo del menú para empezar.": ["No items yet. Pick something from the menu to start.", "Ainda não há produtos. Escolha algo do cardápio para começar.", "Ancora nessun prodotto. Scegli qualcosa dal menù per iniziare."],
    "Tu pedido está vacío. Agrega una pizza del menú o arma la tuya.": ["Your order is empty. Add a pizza from the menu or build your own.", "Seu pedido está vazio. Adicione uma pizza do cardápio ou monte a sua.", "Il tuo ordine è vuoto. Aggiungi una pizza dal menù o creala tu."],
    "Todavía no hay nada en el pedido.": ["Nothing in your order yet.", "Ainda não há nada no pedido.", "Nell'ordine non c'è ancora niente."],
    "Seguir pidiendo": ["Keep ordering", "Continuar pedindo", "Continua a ordinare"],
    "Seguir comprando": ["Keep shopping", "Continuar comprando", "Continua gli acquisti"],
    "Ir al menú": ["Go to menu", "Ir ao cardápio", "Vai al menù"],
    "Menú": ["Menu", "Cardápio", "Menù"],
    "Ver el menú": ["See the menu", "Ver o cardápio", "Vedi il menù"],
    "Desliza para abrirla": ["Scroll to open it", "Role para abrir", "Scorri per aprirlo"],
    "Eliminar": ["Remove", "Remover", "Elimina"],
    "Quitar": ["Remove", "Remover", "Rimuovi"],
    "Quitar todos": ["Remove all", "Remover todos", "Rimuovi tutti"],
    "Vaciar": ["Empty", "Esvaziar", "Svuota"],
    "Vaciar pedido": ["Empty order", "Esvaziar pedido", "Svuota ordine"],
    "Vaciar carrito": ["Empty cart", "Esvaziar carrinho", "Svuota carrello"],
    "Pedido vacío": ["Order emptied", "Pedido esvaziado", "Ordine svuotato"],
    "¿Seguro? Toca otra vez": ["Sure? Tap again", "Tem certeza? Toque de novo", "Sicuro? Tocca di nuovo"],
    "Cerrar": ["Close", "Fechar", "Chiudi"],
    "Cerrar pedido": ["Close order", "Fechar pedido", "Chiudi ordine"],
    "Cerrar carrito": ["Close cart", "Fechar carrinho", "Chiudi carrello"],
    "Total": ["Total", "Total", "Totale"],
    "Total a pagar": ["Total to pay", "Total a pagar", "Totale da pagare"],
    "Quitar uno": ["Remove one", "Remover um", "Togli uno"],
    "Agregar uno": ["Add one", "Adicionar um", "Aggiungi uno"],
    "Quitar una": ["Remove one", "Remover uma", "Togli una"],
    "Agregar una": ["Add one", "Adicionar uma", "Aggiungi una"],
    "Agregar otro": ["Add another", "Adicionar outro", "Aggiungi un altro"],
    "Una menos": ["One less", "Uma a menos", "Una in meno"],
    "Una más": ["One more", "Mais uma", "Una in più"],
    "Categorías del menú": ["Menu categories", "Categorias do cardápio", "Categorie del menù"],
    "Categorías": ["Categories", "Categorias", "Categorie"],
    "Secciones": ["Sections", "Seções", "Sezioni"],
    "Pasos": ["Steps", "Etapas", "Passaggi"],
    "Ir a": ["Go to", "Ir para", "Vai a"],
    "Precios en dólares": ["Prices in US dollars", "Preços em dólares", "Prezzi in dollari"],
    "Pedidos": ["Orders", "Pedidos", "Ordini"],
    "Nuevo": ["New", "Novo", "Nuovo"],
    "De la casa": ["House special", "Da casa", "Della casa"],
    "Favorito": ["Favorite", "Favorito", "Preferito"],
    "La más pedida": ["Most ordered", "A mais pedida", "La più ordinata"],
    "Lo más pedido": ["Most ordered", "O mais pedido", "Il più ordinato"],
    "Clásica": ["Classic", "Clássica", "Classica"],
    "Picante": ["Spicy", "Picante", "Piccante"],
    "Para compartir": ["To share", "Para compartilhar", "Da condividere"],
    "En la vista previa no se envían pedidos.": ["Orders are not sent from the preview.", "Na pré-visualização os pedidos não são enviados.", "Dall'anteprima gli ordini non vengono inviati."],

    // Datos del cliente y envío del pedido
    "Nombre": ["Name", "Nome", "Nome"],
    "Tu nombre": ["Your name", "Seu nome", "Il tuo nome"],
    "¿A nombre de quién?": ["Name for the order?", "Em nome de quem?", "A nome di chi?"],
    "Ej: María González": ["e.g. Mary Smith", "Ex.: Maria Silva", "Es.: Maria Rossi"],
    "Dirección": ["Address", "Endereço", "Indirizzo"],
    "Dirección de entrega": ["Delivery address", "Endereço de entrega", "Indirizzo di consegna"],
    "Calle, casa o edificio, punto de referencia": ["Street, house or building, landmark", "Rua, casa ou prédio, ponto de referência", "Via, casa o edificio, punto di riferimento"],
    "Calle, casa o edificio, referencia": ["Street, house or building, landmark", "Rua, casa ou prédio, referência", "Via, casa o edificio, riferimento"],
    "Calle, casa, punto de referencia": ["Street, house, landmark", "Rua, casa, ponto de referência", "Via, casa, punto di riferimento"],
    "Tipo de entrega": ["Order type", "Tipo de entrega", "Tipo di consegna"],
    "¿Cómo lo quieres?": ["How do you want it?", "Como você quer?", "Come lo vuoi?"],
    "Para llevar": ["Takeaway", "Para viagem", "Da asporto"],
    "Comer aquí": ["Eat here", "Comer aqui", "Mangiare qui"],
    "Delivery": ["Delivery", "Entrega", "Consegna"],
    "Forma de pago": ["Payment method", "Forma de pagamento", "Metodo di pagamento"],
    "Formas de pago": ["Payment methods", "Formas de pagamento", "Metodi di pagamento"],
    "Efectivo": ["Cash", "Dinheiro", "Contanti"],
    "Punto de venta": ["Card (POS)", "Cartão (maquininha)", "Carta (POS)"],
    "Envía la captura del pago por WhatsApp.": ["Send the payment screenshot on WhatsApp.", "Envie o comprovante do pagamento pelo WhatsApp.", "Invia lo screenshot del pagamento su WhatsApp."],
    "Dólares o bolívares. Si necesitas cambio, dinos con cuánto pagas.": ["US dollars or bolívares. If you need change, tell us how much you'll pay with.", "Dólares ou bolívares. Se precisar de troco, diga com quanto vai pagar.", "Dollari o bolívares. Se ti serve il resto, dicci con quanto paghi."],
    "Tarjeta de débito o crédito en el local.": ["Debit or credit card at the shop.", "Cartão de débito ou crédito no local.", "Carta di debito o di credito nel locale."],
    "Pagas con tu huella en el local.": ["Pay with your fingerprint at the shop.", "Pague com sua digital no local.", "Paghi con l'impronta digitale nel locale."],
    "Copiar": ["Copy", "Copiar", "Copia"],
    "Copiado": ["Copied", "Copiado", "Copiato"],
    "Notas (opcional)": ["Notes (optional)", "Observações (opcional)", "Note (facoltative)"],
    "Notas para la cocina": ["Notes for the kitchen", "Observações para a cozinha", "Note per la cucina"],
    "(opcional)": ["(optional)", "(opcional)", "(facoltativo)"],
    "Ej: sin cebolla, salsas aparte, bien cocido": ["e.g. no onion, sauces on the side, well done", "Ex.: sem cebola, molhos à parte, bem passado", "Es.: senza cipolla, salse a parte, ben cotto"],
    "Ej: sin ajonjolí, salsa de soya extra": ["e.g. no sesame, extra soy sauce", "Ex.: sem gergelim, molho de soja extra", "Es.: senza sesamo, salsa di soia extra"],
    "Ej: sin picante, bien tostada": ["e.g. not spicy, well toasted", "Ex.: sem pimenta, bem tostada", "Es.: non piccante, ben tostata"],
    "Sin cebolla, cortar en 8, etc.": ["No onion, cut in 8, etc.", "Sem cebola, cortar em 8, etc.", "Senza cipolla, tagliata in 8, ecc."],
    "Por ejemplo: es para regalo": ["For example: it's a gift", "Por exemplo: é para presente", "Per esempio: è un regalo"],
    "Confirmar y enviar pedido": ["Confirm and send order", "Confirmar e enviar pedido", "Conferma e invia l'ordine"],
    "Enviar pedido por WhatsApp": ["Send order on WhatsApp", "Enviar pedido pelo WhatsApp", "Invia l'ordine su WhatsApp"],
    "Copiar mensaje": ["Copy message", "Copiar mensagem", "Copia messaggio"],
    "Copiar pedido": ["Copy order", "Copiar pedido", "Copia ordine"],
    "Mensaje copiado": ["Message copied", "Mensagem copiada", "Messaggio copiato"],
    "Selecciona y copia el mensaje": ["Select and copy the message", "Selecione e copie a mensagem", "Seleziona e copia il messaggio"],
    "Pedido copiado. Pégalo en WhatsApp.": ["Order copied. Paste it in WhatsApp.", "Pedido copiado. Cole no WhatsApp.", "Ordine copiato. Incollalo su WhatsApp."],
    "Cópialo desde aquí abajo": ["Copy it from below", "Copie aqui embaixo", "Copialo qui sotto"],
    "Llega al WhatsApp del local:": ["It goes to the shop's WhatsApp:", "Chega ao WhatsApp da loja:", "Arriva al WhatsApp del locale:"],
    "Texto del pedido para copiar": ["Order text to copy", "Texto do pedido para copiar", "Testo dell'ordine da copiare"],
    "Escribe tu nombre para confirmar.": ["Write your name to confirm.", "Escreva seu nome para confirmar.", "Scrivi il tuo nome per confermare."],
    "Escribe tu nombre para el pedido.": ["Write your name for the order.", "Escreva seu nome para o pedido.", "Scrivi il tuo nome per l'ordine."],
    "Escribe tu nombre para enviar el pedido.": ["Write your name to send the order.", "Escreva seu nome para enviar o pedido.", "Scrivi il tuo nome per inviare l'ordine."],
    "Escribe la dirección del delivery.": ["Write the delivery address.", "Escreva o endereço de entrega.", "Scrivi l'indirizzo di consegna."],
    "Escribe la dirección de entrega.": ["Write the delivery address.", "Escreva o endereço de entrega.", "Scrivi l'indirizzo di consegna."],
    "Escribe la ciudad y la agencia de envío.": ["Write the city and the shipping agency.", "Escreva a cidade e a transportadora.", "Scrivi la città e l'agenzia di spedizione."],
    "Elige cómo vas a pagar.": ["Choose how you'll pay.", "Escolha como vai pagar.", "Scegli come pagherai."],
    "Agrega al menos un producto.": ["Add at least one item.", "Adicione pelo menos um produto.", "Aggiungi almeno un prodotto."],
    "Agregado": ["Added", "Adicionado", "Aggiunto"],

    // El local, horario y redes
    "El local": ["The shop", "A loja", "Il locale"],
    "Horario": ["Opening hours", "Horário", "Orari"],
    "Contacto": ["Contact", "Contato", "Contatti"],
    "Dónde estamos": ["Where we are", "Onde estamos", "Dove siamo"],
    "Dónde estamos, cuándo abrimos y cómo pagar.": ["Where we are, when we open and how to pay.", "Onde estamos, quando abrimos e como pagar.", "Dove siamo, quando apriamo e come pagare."],
    "Cómo llegar": ["Directions", "Como chegar", "Come arrivare"],
    "Abrir en Google Maps": ["Open in Google Maps", "Abrir no Google Maps", "Apri in Google Maps"],
    "Síguenos": ["Follow us", "Siga-nos", "Seguici"],
    "Info": ["Info", "Info", "Info"],
    "Lunes": ["Monday", "Segunda-feira", "Lunedì"],
    "Martes": ["Tuesday", "Terça-feira", "Martedì"],
    "Miércoles": ["Wednesday", "Quarta-feira", "Mercoledì"],
    "Jueves": ["Thursday", "Quinta-feira", "Giovedì"],
    "Viernes": ["Friday", "Sexta-feira", "Venerdì"],
    "Sábado": ["Saturday", "Sábado", "Sabato"],
    "Domingo": ["Sunday", "Domingo", "Domenica"],
    "lunes": ["Monday", "segunda-feira", "lunedì"],
    "martes": ["Tuesday", "terça-feira", "martedì"],
    "miércoles": ["Wednesday", "quarta-feira", "mercoledì"],
    "jueves": ["Thursday", "quinta-feira", "giovedì"],
    "viernes": ["Friday", "sexta-feira", "venerdì"],
    "sábado": ["Saturday", "sábado", "sabato"],
    "domingo": ["Sunday", "domingo", "domenica"],
    "Cerrado por hoy": ["Closed today", "Fechado hoje", "Chiuso oggi"],
    "Cerrado": ["Closed", "Fechado", "Chiuso"],
    "Abierto": ["Open", "Aberto", "Aperto"],
    "Puedes dejar tu pedido y te respondemos apenas abramos.": ["You can leave your order and we'll reply as soon as we open.", "Você pode deixar seu pedido e responderemos assim que abrirmos.", "Puoi lasciare il tuo ordine e ti risponderemo appena apriamo."],
    "Puedes enviar tu pedido y te respondemos apenas abramos.": ["You can send your order and we'll reply as soon as we open.", "Você pode enviar seu pedido e responderemos assim que abrirmos.", "Puoi inviare il tuo ordine e ti risponderemo appena apriamo."],
    "Esta es una página de muestra de EU Digital Solutions.": ["This is a sample page by EU Digital Solutions.", "Esta é uma página de exemplo da EU Digital Solutions.", "Questa è una pagina di esempio di EU Digital Solutions."],
    "Pruébala gratis con tu negocio": ["Try it free with your business", "Experimente grátis com o seu negócio", "Provala gratis con la tua attività"],
    "Créala gratis con tu menú": ["Create it free with your menu", "Crie grátis com o seu cardápio", "Creala gratis con il tuo menù"],
    "Mascota bailarina, tócala para que salte": ["Dancing mascot, tap it to make it jump", "Mascote dançante, toque para ela pular", "Mascotte ballerina, toccala per farla saltare"],
    "Mascota bailarina": ["Dancing mascot", "Mascote dançante", "Mascotte ballerina"],
    "Hamburguesa abriéndose capa por capa": ["Burger opening layer by layer", "Hambúrguer se abrindo camada por camada", "Hamburger che si apre strato per strato"],
    "Hamburguesa que se abre al bajar": ["Burger that opens as you scroll", "Hambúrguer que se abre ao rolar", "Hamburger che si apre scorrendo"],
    "Portada": ["Cover", "Capa", "Copertina"],

    // Categorías y palabras de menú comunes
    "Bebidas": ["Drinks", "Bebidas", "Bevande"],
    "Bebida": ["Drink", "Bebida", "Bevanda"],
    "Extras": ["Extras", "Extras", "Extra"],
    "Entradas": ["Starters", "Entradas", "Antipasti"],
    "Hamburguesas": ["Burgers", "Hambúrgueres", "Hamburger"],
    "Perros": ["Hot dogs", "Cachorros-quentes", "Hot dog"],
    "Pizzas": ["Pizzas", "Pizzas", "Pizze"],
    "Bandejas": ["Platters", "Bandejas", "Vassoi"],
    "Postres": ["Desserts", "Sobremesas", "Dolci"],
    "Combos": ["Combos", "Combos", "Combo"],
    "Ensaladas": ["Salads", "Saladas", "Insalate"],
    "Carnes": ["Meats", "Carnes", "Carni"],
    "Quesos": ["Cheeses", "Queijos", "Formaggi"],
    "Vegetales": ["Vegetables", "Vegetais", "Verdure"],
    "Otros": ["Others", "Outros", "Altri"],
    "Incluido": ["Included", "Incluído", "Incluso"],
    "Incluida": ["Included", "Incluída", "Inclusa"],
    "Agua": ["Water", "Água", "Acqua"],
    "Aceitunas": ["Olives", "Azeitonas", "Olive"],
    "Albahaca": ["Basil", "Manjericão", "Basilico"],
    "Champiñones": ["Mushrooms", "Cogumelos", "Funghi"],
    "Cebolla": ["Onion", "Cebola", "Cipolla"],
    "Cebolla morada": ["Red onion", "Cebola roxa", "Cipolla rossa"],
    "Jamón": ["Ham", "Presunto", "Prosciutto cotto"],
    "Maíz": ["Corn", "Milho", "Mais"],
    "Pimentón": ["Bell pepper", "Pimentão", "Peperone"],
    "Piña": ["Pineapple", "Abacaxi", "Ananas"],
    "Pollo": ["Chicken", "Frango", "Pollo"],
    "Queso": ["Cheese", "Queijo", "Formaggio"],
    "Queso feta": ["Feta cheese", "Queijo feta", "Feta"],
    "Rúcula": ["Arugula", "Rúcula", "Rucola"],
    "Tocineta": ["Bacon", "Bacon", "Pancetta"],
    "Tomate": ["Tomato", "Tomate", "Pomodoro"],
    "Huevo": ["Egg", "Ovo", "Uovo"],
    "Aguacate": ["Avocado", "Abacate", "Avocado"],
    "Carne mechada": ["Shredded beef", "Carne desfiada", "Manzo sfilacciato"],
    "Pollo desmechado": ["Shredded chicken", "Frango desfiado", "Pollo sfilacciato"],
    "Pernil": ["Roast pork", "Pernil assado", "Arrosto di maiale"],
    "Chicharrón": ["Pork crackling", "Torresmo", "Ciccioli di maiale"],
    "Carne asada": ["Grilled beef", "Carne grelhada", "Carne alla griglia"],
    "Queso blanco rallado": ["Grated white cheese", "Queijo branco ralado", "Formaggio bianco grattugiato"],
    "Queso amarillo": ["Yellow cheese", "Queijo amarelo", "Formaggio giallo"],
    "Queso de mano": ["Fresh hand cheese", "Queijo fresco artesanal", "Formaggio fresco artigianale"],
    "Caraotas": ["Black beans", "Feijão-preto", "Fagioli neri"],
    "Tajadas": ["Fried ripe plantain", "Banana-da-terra frita", "Platano fritto"],

    // Pizzería: arma tu pizza
    "Arma tu pizza": ["Build your pizza", "Monte sua pizza", "Crea la tua pizza"],
    "Armar": ["Build", "Montar", "Crea"],
    "Personalizar": ["Customize", "Personalizar", "Personalizza"],
    "Tamaño": ["Size", "Tamanho", "Dimensione"],
    "Masa": ["Crust", "Massa", "Impasto"],
    "Salsa": ["Sauce", "Molho", "Salsa"],
    "Ingredientes": ["Toppings", "Ingredientes", "Ingredienti"],
    "Personal": ["Personal", "Individual", "Personale"],
    "Mediana": ["Medium", "Média", "Media"],
    "Familiar": ["Family", "Família", "Famiglia"],
    "Tradicional": ["Traditional", "Tradicional", "Tradizionale"],
    "Delgada": ["Thin", "Fina", "Sottile"],
    "Borde de queso": ["Cheese-stuffed crust", "Borda recheada de queijo", "Bordo ripieno di formaggio"],
    "Blanca": ["White", "Branca", "Bianca"],
    "Extra queso": ["Extra cheese", "Queijo extra", "Formaggio extra"],
    "4 quesos": ["4 cheeses", "4 queijos", "4 formaggi"],
    "Entera": ["Whole", "Inteira", "Intera"],
    "Mitad y mitad": ["Half and half", "Meio a meio", "Metà e metà"],
    "Mitad 1": ["Half 1", "Metade 1", "Metà 1"],
    "Mitad 2": ["Half 2", "Metade 2", "Metà 2"],
    "Forma de la pizza": ["Pizza style", "Formato da pizza", "Formato della pizza"],
    "Vista previa de tu pizza": ["Preview of your pizza", "Prévia da sua pizza", "Anteprima della tua pizza"],
    "Toca un ingrediente y míralo caer en tu pizza.": ["Tap a topping and watch it fall onto your pizza.", "Toque em um ingrediente e veja-o cair na sua pizza.", "Tocca un ingrediente e guardalo cadere sulla tua pizza."],
    "Empieza con un sabor de la casa": ["Start with a house flavor", "Comece com um sabor da casa", "Inizia con un gusto della casa"],
    "Elige un sabor para cada mitad de tu pizza.": ["Choose a flavor for each half of your pizza.", "Escolha um sabor para cada metade da sua pizza.", "Scegli un gusto per ogni metà della tua pizza."],
    "¿Dos sabores? Pide mitad y mitad": ["Two flavors? Order half and half", "Dois sabores? Peça meio a meio", "Due gusti? Ordina metà e metà"],
    "¿Algo para tomar?": ["Something to drink?", "Algo para beber?", "Qualcosa da bere?"],
    "Retiras tú": ["You pick it up", "Você retira", "Ritiri tu"],
    "A domicilio": ["To your door", "Em domicílio", "A domicilio"],
    "En el local": ["At the shop", "No local", "Nel locale"],
    "Pizzas de la casa": ["House pizzas", "Pizzas da casa", "Pizze della casa"],
    "Pizza a tu gusto": ["Pizza your way", "Pizza do seu jeito", "Pizza a modo tuo"],
    "Pizza mitad y mitad": ["Half-and-half pizza", "Pizza meio a meio", "Pizza metà e metà"],
    "Ahora elige la mitad 2": ["Now choose half 2", "Agora escolha a metade 2", "Ora scegli la metà 2"],
    "Listo. Ahora elige la mitad 2": ["Done. Now choose half 2", "Pronto. Agora escolha a metade 2", "Fatto. Ora scegli la metà 2"],
    "Quedó entera, como la mitad 1": ["It's whole now, like half 1", "Ficou inteira, como a metade 1", "Ora è intera, come la metà 1"],
    "Elige el sabor de la mitad 1": ["Choose the flavor of half 1", "Escolha o sabor da metade 1", "Scegli il gusto della metà 1"],
    "solo queso": ["cheese only", "só queijo", "solo formaggio"],
    "Para llevar (retiro en el local)": ["Takeaway (pickup at the shop)", "Para viagem (retirada no local)", "Da asporto (ritiro nel locale)"],
    "Para comer en el local": ["To eat at the shop", "Para comer no local", "Da mangiare nel locale"],
    "Elige una de la casa o arma la tuya ingrediente por ingrediente. Te la confirmamos por WhatsApp.": ["Pick a house pizza or build yours topping by topping. We'll confirm it on WhatsApp.", "Escolha uma da casa ou monte a sua ingrediente por ingrediente. Confirmamos pelo WhatsApp.", "Scegli una della casa o creala ingrediente per ingrediente. Te la confermiamo su WhatsApp."],
    "Pizza al horno, hecha a tu gusto": ["Oven-baked pizza, made your way", "Pizza no forno, do seu jeito", "Pizza al forno, fatta a modo tuo"],

    // Arepera
    "Arma tu": ["Build your", "Monte sua", "Crea la tua"],
    "¡Hola! Rellena tu arepa": ["Hi! Fill your arepa", "Oi! Recheie sua arepa", "Ciao! Farcisci la tua arepa"],
    "¡Arma otra!": ["Build another one!", "Monte outra!", "Creane un'altra!"],
    "¡Qué rico!": ["Yummy!", "Que delícia!", "Che buono!"],
    "Elige carnes, quesos y extras, y pide por WhatsApp.": ["Choose meats, cheeses and extras, and order on WhatsApp.", "Escolha carnes, queijos e extras, e peça pelo WhatsApp.", "Scegli carni, formaggi ed extra, e ordina su WhatsApp."],
    "Tipos de ingredientes": ["Ingredient types", "Tipos de ingredientes", "Tipi di ingredienti"],
    "Tu arepa": ["Your arepa", "Sua arepa", "La tua arepa"],
    "Arepa sola": ["Plain arepa", "Arepa simples", "Arepa semplice"],
    "Los demás no tienen costo.": ["The rest are free.", "Os demais não têm custo.", "Gli altri sono gratis."],
    "Sin costo adicional.": ["No extra cost.", "Sem custo adicional.", "Senza costi aggiuntivi."],

    // Sushi
    "Arma tu pedido, revísalo en el carrito y envíalo directo a nuestro WhatsApp.": ["Build your order, check it in the cart and send it straight to our WhatsApp.", "Monte seu pedido, confira no carrinho e envie direto para o nosso WhatsApp.", "Componi il tuo ordine, controllalo nel carrello e invialo direttamente al nostro WhatsApp."],
    "Precios en dólares. Las bandejas se arman con la pieza del día.": ["Prices in US dollars. Platters are made with the catch of the day.", "Preços em dólares. As bandejas são montadas com o peixe do dia.", "Prezzi in dollari. I vassoi si preparano con il pesce del giorno."],

    // Boutique
    "Buscar prendas": ["Search items", "Buscar peças", "Cerca capi"],
    "Busca vestidos, lino, lunares…": ["Search dresses, linen, polka dots…", "Busque vestidos, linho, poá…", "Cerca vestiti, lino, pois…"],
    "Todo": ["All", "Tudo", "Tutto"],
    "Vestidos": ["Dresses", "Vestidos", "Vestiti"],
    "Blusas": ["Blouses", "Blusas", "Camicette"],
    "Faldas": ["Skirts", "Saias", "Gonne"],
    "Pantalones": ["Pants", "Calças", "Pantaloni"],
    "Conjuntos": ["Sets", "Conjuntos", "Completi"],
    "Elegir talla": ["Choose size", "Escolher tamanho", "Scegli la taglia"],
    "Talla": ["Size", "Tamanho", "Taglia"],
    "Guía de tallas": ["Size guide", "Guia de tamanhos", "Guida alle taglie"],
    "Cerrar guía de tallas": ["Close size guide", "Fechar guia de tamanhos", "Chiudi guida alle taglie"],
    "Busto": ["Bust", "Busto", "Busto"],
    "Cintura": ["Waist", "Cintura", "Vita"],
    "Cadera": ["Hips", "Quadril", "Fianchi"],
    "Color:": ["Color:", "Cor:", "Colore:"],
    "Color": ["Color", "Cor", "Colore"],
    "Medidas del cuerpo en centímetros. Si estás entre dos tallas, elige la más grande.": ["Body measurements in centimeters. If you're between two sizes, choose the larger one.", "Medidas do corpo em centímetros. Se estiver entre dois tamanhos, escolha o maior.", "Misure del corpo in centimetri. Se sei tra due taglie, scegli la più grande."],
    "Mide sobre la ropa interior, con la cinta firme pero sin apretar.": ["Measure over your underwear, with the tape snug but not tight.", "Meça sobre a roupa íntima, com a fita firme mas sem apertar.", "Misura sopra la biancheria, con il metro aderente ma senza stringere."],
    "Toda la colección": ["The whole collection", "Toda a coleção", "Tutta la collezione"],
    "Ver toda la colección": ["See the whole collection", "Ver toda a coleção", "Vedi tutta la collezione"],
    "Ver la colección": ["See the collection", "Ver a coleção", "Vedi la collezione"],
    "Desliza sobre la prenda para girarla": ["Swipe over the item to turn it", "Deslize sobre a peça para girá-la", "Scorri sul capo per girarlo"],
    "Desliza sobre la prenda o toca Frente, Lado y Espalda en la cinta": ["Swipe over the item or tap Front, Side and Back on the tape", "Deslize sobre a peça ou toque em Frente, Lado e Costas na fita", "Scorri sul capo o tocca Davanti, Lato e Dietro sul metro"],
    "Frente": ["Front", "Frente", "Davanti"],
    "Lado": ["Side", "Lado", "Lato"],
    "Espalda": ["Back", "Costas", "Dietro"],
    "Girar la prenda": ["Turn the item", "Girar a peça", "Gira il capo"],
    "Prenda en 360 grados": ["Item in 360 degrees", "Peça em 360 graus", "Capo a 360 gradi"],
    "Volver al catálogo": ["Back to catalog", "Voltar ao catálogo", "Torna al catalogo"],
    "Datos para el pedido": ["Order details", "Dados do pedido", "Dati dell'ordine"],
    "Entrega": ["Delivery method", "Entrega", "Consegna"],
    "Retiro en tienda": ["Store pickup", "Retirada na loja", "Ritiro in negozio"],
    "Envío nacional": ["Nationwide shipping", "Envio nacional", "Spedizione nazionale"],
    "Nota para la tienda": ["Note for the store", "Observação para a loja", "Nota per il negozio"],
    "Cuando envíes el mensaje en WhatsApp, la tienda te confirma el pedido y el pago.": ["When you send the WhatsApp message, the store confirms your order and payment.", "Quando você enviar a mensagem no WhatsApp, a loja confirma o pedido e o pagamento.", "Quando invii il messaggio su WhatsApp, il negozio ti conferma l'ordine e il pagamento."],
    "Elige una prenda, su color y tu talla. Cuando la agregues, aquí podrás enviar el pedido por WhatsApp.": ["Choose an item, its color and your size. Once you add it, you can send the order on WhatsApp from here.", "Escolha uma peça, a cor e o seu tamanho. Quando adicionar, aqui você poderá enviar o pedido pelo WhatsApp.", "Scegli un capo, il colore e la tua taglia. Quando lo aggiungi, da qui potrai inviare l'ordine su WhatsApp."],
    "No hay prendas con esa búsqueda.": ["No items match your search.", "Nenhuma peça encontrada.", "Nessun capo trovato."],
    "Prueba con otra palabra, como “vestido”, “lino” o “negro”.": ["Try another word, like “vestido” (dress), “lino” (linen) or “negro” (black).", "Tente outra palavra, como “vestido”, “lino” (linho) ou “negro” (preto).", "Prova un'altra parola, come “vestido” (vestito), “lino” o “negro” (nero)."],
    "¿No se abrió WhatsApp? Escribe al": ["WhatsApp didn't open? Write to", "O WhatsApp não abriu? Escreva para", "WhatsApp non si è aperto? Scrivi al"],
    "Pedidos y redes": ["Orders and social media", "Pedidos e redes", "Ordini e social"],
    "Tienda de muestra: el catálogo, los precios, la dirección y las redes son de ejemplo.": ["Sample store: the catalog, prices, address and social links are examples.", "Loja de exemplo: o catálogo, os preços, o endereço e as redes são de exemplo.", "Negozio di esempio: catalogo, prezzi, indirizzo e social sono di esempio."],
    "Elige tu talla para agregar la prenda al carrito.": ["Choose your size to add the item to your cart.", "Escolha seu tamanho para adicionar a peça ao carrinho.", "Scegli la tua taglia per aggiungere il capo al carrello."],
    "Esta prenda está agotada en todas las tallas. Escríbenos por WhatsApp para saber cuándo vuelve.": ["This item is sold out in every size. Message us on WhatsApp to know when it's back.", "Esta peça está esgotada em todos os tamanhos. Fale conosco pelo WhatsApp para saber quando volta.", "Questo capo è esaurito in tutte le taglie. Scrivici su WhatsApp per sapere quando torna."],
    "Abrir carrito, vacío": ["Open cart, empty", "Abrir carrinho, vazio", "Apri carrello, vuoto"],
    "Este teléfono no puede mostrar la vista 360. Igual puedes ver los colores, elegir tu talla y pedir.": ["This phone can't show the 360 view. You can still see the colors, choose your size and order.", "Este telefone não consegue mostrar a vista 360. Mesmo assim você pode ver as cores, escolher o tamanho e pedir.", "Questo telefono non può mostrare la vista a 360. Puoi comunque vedere i colori, scegliere la taglia e ordinare."],
    "La vista 360 no cargó. Revisa tu conexión y vuelve a abrir la página.": ["The 360 view didn't load. Check your connection and reopen the page.", "A vista 360 não carregou. Verifique sua conexão e abra a página de novo.", "La vista a 360 non si è caricata. Controlla la connessione e riapri la pagina."],
    "Te avisamos por WhatsApp cuando esté listo.": ["We'll let you know on WhatsApp when it's ready.", "Avisamos pelo WhatsApp quando estiver pronto.", "Ti avvisiamo su WhatsApp quando è pronto."],
    "Quitamos del carrito una prenda que se agotó.": ["We removed an item that sold out from your cart.", "Removemos do carrinho uma peça que esgotou.", "Abbiamo tolto dal carrello un capo esaurito."],

    // Cupones y promociones
    "¿Tienes un cupón de descuento?": ["Have a discount coupon?", "Tem um cupom de desconto?", "Hai un coupon di sconto?"],
    "Cupón de descuento": ["Discount coupon", "Cupom de desconto", "Coupon di sconto"],
    "Escribe el código": ["Enter the code", "Digite o código", "Inserisci il codice"],
    "Aplicar": ["Apply", "Aplicar", "Applica"],
    "Ese cupón no existe o ya venció.": ["That coupon doesn't exist or has expired.", "Esse cupom não existe ou já venceu.", "Questo coupon non esiste o è scaduto."],
    "Escribe el código del cupón.": ["Enter the coupon code.", "Digite o código do cupom.", "Inserisci il codice del coupon."],
    "aplicado, pero el descuento para todos te conviene más y es el que se usa.": ["applied, but the general discount is better for you, so that one is used.", "aplicado, mas o desconto para todos é melhor para você e é o que vale.", "applicato, ma lo sconto per tutti ti conviene di più ed è quello che si usa."],

    // Recordar al cliente y repetir pedido
    "¿Lo mismo de la otra vez?": ["Same as last time?", "O mesmo da última vez?", "Lo stesso dell'ultima volta?"],
    "Repetir pedido": ["Repeat order", "Repetir pedido", "Ripeti ordine"],
    "No, gracias": ["No, thanks", "Não, obrigado", "No, grazie"],
    "Tu último pedido": ["Your last order", "Seu último pedido", "Il tuo ultimo ordine"],
    "Listo, agregamos tu último pedido. Revísalo y envíalo.": ["Done, we added your last order. Check it and send it.", "Pronto, adicionamos seu último pedido. Confira e envie.", "Fatto, abbiamo aggiunto il tuo ultimo ordine. Controllalo e invialo."],
    "Listo, agregamos tu último pedido (lo que sigue disponible). Revísalo y envíalo.": ["Done, we added your last order (what's still available). Check it and send it.", "Pronto, adicionamos seu último pedido (o que ainda está disponível). Confira e envie.", "Fatto, abbiamo aggiunto il tuo ultimo ordine (ciò che è ancora disponibile). Controllalo e invialo."],
    "Lo que pediste la otra vez ya no está disponible. Mira el menú de hoy.": ["What you ordered last time is no longer available. Check today's menu.", "O que você pediu da última vez não está mais disponível. Veja o cardápio de hoje.", "Ciò che hai ordinato l'ultima volta non è più disponibile. Guarda il menù di oggi."],
    "Pusimos los datos de tu último pedido.": ["We filled in the details from your last order.", "Preenchemos os dados do seu último pedido.", "Abbiamo inserito i dati del tuo ultimo ordine."],
    "Borrarlos": ["Erase them", "Apagá-los", "Cancellali"],
    "Listo, borramos tus datos de este teléfono.": ["Done, we erased your details from this phone.", "Pronto, apagamos seus dados deste telefone.", "Fatto, abbiamo cancellato i tuoi dati da questo telefono."],

    // Delivery y mapa
    "El delivery tiene un costo adicional según la zona.": ["Delivery has an extra cost depending on the area.", "A entrega tem um custo adicional conforme a região.", "La consegna ha un costo aggiuntivo in base alla zona."],
    "El delivery depende de la distancia. Comparte tu ubicación para calcularlo.": ["Delivery depends on the distance. Share your location to calculate it.", "A entrega depende da distância. Compartilhe sua localização para calcular.", "La consegna dipende dalla distanza. Condividi la tua posizione per calcolarla."],
    "Opcional: comparte tu ubicación para que el repartidor llegue más fácil.": ["Optional: share your location so the driver finds you more easily.", "Opcional: compartilhe sua localização para o entregador chegar mais fácil.", "Facoltativo: condividi la tua posizione così il fattorino ti trova più facilmente."],
    "📍 Usar mi ubicación": ["📍 Use my location", "📍 Usar minha localização", "📍 Usa la mia posizione"],
    "Usar mi ubicación": ["Use my location", "Usar minha localização", "Usa la mia posizione"],
    "Marcarla en el mapa": ["Mark it on the map", "Marcar no mapa", "Segnala sulla mappa"],
    "Cambiarla en el mapa": ["Change it on the map", "Mudar no mapa", "Cambiala sulla mappa"],
    "Buscando tu ubicación…": ["Finding your location…", "Buscando sua localização…", "Cerco la tua posizione…"],
    "Buscando…": ["Searching…", "Buscando…", "Cerco…"],
    "📍 Listo: le enviamos tu ubicación al repartidor.": ["📍 Done: we'll send your location to the driver.", "📍 Pronto: enviaremos sua localização ao entregador.", "📍 Fatto: invieremo la tua posizione al fattorino."],
    "¿Dónde te llevamos el pedido?": ["Where should we deliver your order?", "Onde entregamos seu pedido?", "Dove ti portiamo l'ordine?"],
    "Toca el mapa o arrastra el marcador hasta tu casa o el lugar de entrega.": ["Tap the map or drag the marker to your home or delivery spot.", "Toque no mapa ou arraste o marcador até sua casa ou local de entrega.", "Tocca la mappa o trascina il segnaposto fino a casa tua o al luogo di consegna."],
    "Toca el mapa o arrastra el marcador hasta el lugar exacto.": ["Tap the map or drag the marker to the exact spot.", "Toque no mapa ou arraste o marcador até o lugar exato.", "Tocca la mappa o trascina il segnaposto nel punto esatto."],
    "Marca el punto en el mapa": ["Mark the spot on the map", "Marque o ponto no mapa", "Segna il punto sulla mappa"],
    "Usar este punto": ["Use this spot", "Usar este ponto", "Usa questo punto"],
    "Cancelar": ["Cancel", "Cancelar", "Annulla"],
    "Cargando el mapa…": ["Loading the map…", "Carregando o mapa…", "Caricamento della mappa…"],
    "Punto elegido": ["Chosen spot", "Ponto escolhido", "Punto scelto"],
    "Este teléfono no permite ver la ubicación. Márcala en el mapa.": ["This phone doesn't allow location. Mark it on the map.", "Este telefone não permite ver a localização. Marque no mapa.", "Questo telefono non permette la posizione. Segnala sulla mappa."],
    "La ubicación solo funciona en páginas seguras (https). Márcala en el mapa.": ["Location only works on secure pages (https). Mark it on the map.", "A localização só funciona em páginas seguras (https). Marque no mapa.", "La posizione funziona solo su pagine sicure (https). Segnala sulla mappa."],
    "No diste permiso para ver tu ubicación. Actívalo en tu navegador o márcala en el mapa.": ["You didn't allow access to your location. Turn it on in your browser or mark it on the map.", "Você não permitiu ver sua localização. Ative no navegador ou marque no mapa.", "Non hai dato il permesso per la posizione. Attivalo nel browser o segnala sulla mappa."],
    "No pudimos encontrar tu ubicación. Revisa que el GPS esté encendido o márcala en el mapa.": ["We couldn't find your location. Check that GPS is on or mark it on the map.", "Não conseguimos encontrar sua localização. Verifique se o GPS está ligado ou marque no mapa.", "Non siamo riusciti a trovare la tua posizione. Controlla che il GPS sia acceso o segnala sulla mappa."],
    "No se pudo abrir el mapa. Revisa tu conexión.": ["The map couldn't open. Check your connection.", "Não foi possível abrir o mapa. Verifique sua conexão.", "Impossibile aprire la mappa. Controlla la connessione."],
  };

  /* ---------- Patrones: textos con números, precios o nombres ($1, $2… es lo que va entre paréntesis) ---------- */
  const P = [
    [/^Cerrado, abre hoy a las ([^.]+?)(\.?)$/, ["Closed, opens today at $1$2", "Fechado, abre hoje às $1$2", "Chiuso, apre oggi alle $1$2"]],
    [/^Cerrado, abre mañana a las ([^.]+?)(\.?)$/, ["Closed, opens tomorrow at $1$2", "Fechado, abre amanhã às $1$2", "Chiuso, apre domani alle $1$2"]],
    [/^Cerrado, abre el (\S+) a las ([^.]+?)(\.?)$/, ["Closed, opens $1 at $2$3", "Fechado, abre $1 às $2$3", "Chiuso, apre $1 alle $2$3"]],
    [/^Abierto hasta las ([^.]+?)(\.?)$/, ["Open until $1$2", "Aberto até $1$2", "Aperto fino alle $1$2"]],
    [/^(\d{1,2}(?::\d\d)? ?[ap]m) a (\d{1,2}(?::\d\d)? ?[ap]m)$/, ["$1 – $2", "$1 – $2", "$1 – $2"]],
    [/^(.+)\. Ver horario, dirección, redes y formas de pago$/, ["$1. See hours, address, social media and payment methods", "$1. Ver horário, endereço, redes e formas de pagamento", "$1. Vedi orari, indirizzo, social e metodi di pagamento"]],
    [/^Ver pedido, (\d+) productos?$/, ["View order, $1 items", "Ver pedido, $1 produtos", "Vedi ordine, $1 prodotti"]],
    [/^Agregar (.+)$/, ["Add $1", "Adicionar $1", "Aggiungi $1"]],
    [/^Eliminar (.+)$/, ["Remove $1", "Remover $1", "Elimina $1"]],
    [/^Quitar (.+?) (\d+)$/, ["Remove $1 $2", "Remover $1 $2", "Rimuovi $1 $2"]],
    [/^Quitar (.+)$/, ["Remove $1", "Remover $1", "Rimuovi $1"]],
    [/^Sumar (.+)$/, ["Add $1", "Adicionar $1", "Aggiungi $1"]],
    [/^(\d+) piezas?$/, ["$1 pieces", "$1 peças", "$1 pezzi"]],
    [/^(\d+) prendas?$/, ["$1 items", "$1 peças", "$1 capi"]],
    [/^(\d+) colores$/, ["$1 colors", "$1 cores", "$1 colori"]],
    [/^(\d+) elegidos?$/, ["$1 selected", "$1 escolhidos", "$1 scelti"]],
    [/^(\d)\. (.+)$/, ["$1. $2", "$1. $2", "$1. $2"]],
    [/^Siguiente: (.+)$/, ["Next: $1", "Próximo: $1", "Avanti: $1"]],
    [/^Hoy sin (.+)$/, ["No $1 today", "Hoje sem $1", "Oggi senza $1"]],
    [/^Sabor de la casa para la mitad (\d)$/, ["House flavor for half $1", "Sabor da casa para a metade $1", "Gusto della casa per la metà $1"]],
    [/^(.+) agregada$/, ["$1 added", "$1 adicionada", "$1 aggiunta"]],
    [/^¡(.+) al pedido!$/, ["$1 added to your order!", "$1 no pedido!", "$1 nell'ordine!"]],
    [/^Tu (.+) de (\$[\d.,]+) incluye (\d+) de aquí\. Cada uno de más suma (\$[\d.,]+)\.$/, ["Your $1 for $2 includes $3 from here. Each extra one adds $4.", "Sua $1 de $2 inclui $3 daqui. Cada um a mais soma $4.", "La tua $1 da $2 include $3 di questi. Ognuno in più costa $4."]],
    [/^Tu (.+) de (\$[\d.,]+) incluye (\d+) de aquí\. Los demás no tienen costo\.$/, ["Your $1 for $2 includes $3 from here. The rest are free.", "Sua $1 de $2 inclui $3 daqui. Os demais não têm custo.", "La tua $1 da $2 include $3 di questi. Gli altri sono gratis."]],
    [/^Cada uno suma (\$[\d.,]+)\.$/, ["Each one adds $1.", "Cada um soma $1.", "Ognuno costa $1."]],
    [/^Cada uno de más suma (\$[\d.,]+)\.$/, ["Each extra one adds $1.", "Cada um a mais soma $1.", "Ognuno in più costa $1."]],
    [/^(\$[\d.,]+) c\/u$/, ["$1 each", "$1 cada", "$1 l'uno"]],
    [/^Arepa con (.+)$/, ["Arepa with $1", "Arepa com $1", "Arepa con $1"]],
    [/^Total (\$[\d.,]+)$/, ["Total $1", "Total $1", "Totale $1"]],
    [/^Se abrió WhatsApp con tu pedido\. Si no se abrió, cópialo y envíalo al (.+)\.$/, ["WhatsApp opened with your order. If it didn't, copy it and send it to $1.", "O WhatsApp abriu com seu pedido. Se não abriu, copie e envie para $1.", "WhatsApp si è aperto con il tuo ordine. Se non si è aperto, copialo e invialo al $1."]],
    [/^Agrega al menos una (.+) o una bebida\.$/, ["Add at least one $1 or a drink.", "Adicione pelo menos uma $1 ou uma bebida.", "Aggiungi almeno una $1 o una bevanda."]],
    [/^Resultados para “(.+)”$/, ["Results for “$1”", "Resultados para “$1”", "Risultati per “$1”"]],
    [/^Agotada en (.+)\.$/, ["Sold out in $1.", "Esgotada em $1.", "Esaurita in $1."]],
    [/^(.+), talla (.+), agregado al carrito$/, ["$1, size $2, added to cart", "$1, tamanho $2, adicionado ao carrinho", "$1, taglia $2, aggiunto al carrello"]],
    [/^Abrir carrito, (\d+) prendas?$/, ["Open cart, $1 items", "Abrir carrinho, $1 peças", "Apri carrello, $1 capi"]],
    [/^Cantidad de (.+)$/, ["Quantity of $1", "Quantidade de $1", "Quantità di $1"]],
    [/^Quitamos del carrito (\d+) prendas que se agotaron\.$/, ["We removed $1 items that sold out from your cart.", "Removemos do carrinho $1 peças que esgotaram.", "Abbiamo tolto dal carrello $1 capi esauriti."]],
    [/^Retiras en (.+)\. Te avisamos por WhatsApp cuando esté lista\.$/, ["Pick it up at $1. We'll let you know on WhatsApp when it's ready.", "Retire em $1. Avisamos pelo WhatsApp quando estiver pronto.", "Ritiri in $1. Ti avvisiamo su WhatsApp quando è pronto."]],
    [/^Así se vería la página de (.+)\.$/, ["This is how $1's page would look.", "Assim ficaria a página de $1.", "Ecco come sarebbe la pagina di $1."]],
    [/^Cupón (\S+)$/, ["Coupon $1", "Cupom $1", "Coupon $1"]],
    [/^Cupón (\S+) \((.+)\)$/, ["Coupon $1 ($2)", "Cupom $1 ($2)", "Coupon $1 ($2)"]],
    [/^Descuento (.+)$/, ["Discount $1", "Desconto $1", "Sconto $1"]],
    [/^aplicado: (.+)$/, ["applied: $1", "aplicado: $1", "applicato: $1"]],
    [/^aplica en pedidos desde (\$[\d.,]+)\. Te faltan (\$[\d.,]+)\.$/, ["applies to orders from $1. You need $2 more.", "vale para pedidos a partir de $1. Faltam $2.", "vale per ordini da $1. Ti mancano $2."]],
    [/^(.+?) de descuento en tu pedido(?: desde (\$[\d.,]+))?(?:, hasta el (.+))?$/, (m) => {
      const [, cuanto, desde, hasta] = m;
      const t = [[" off your order", " from ", ", until "], [" de desconto no seu pedido", " a partir de ", ", até "], [" di sconto sul tuo ordine", " da ", ", fino al "]][COL[id]];
      return cuanto + t[0] + (desde ? t[1] + desde : "") + (hasta ? t[2] + hasta : "");
    }],
    [/^El delivery cuesta (\$[\d.,]+)\.$/, ["Delivery costs $1.", "A entrega custa $1.", "La consegna costa $1."]],
    [/^El delivery depende de la distancia: (.+)\.$/, (m) => {
      const h = ["up to ", "até ", "fino a "][COL[id]];
      return ["Delivery depends on the distance: ", "A entrega depende da distância: ", "La consegna dipende dalla distanza: "][COL[id]] + m[1].replace(/hasta /g, h) + ".";
    }],
    [/^📍 Estás a unos (.+) km\. Delivery:$/, ["📍 You're about $1 km away. Delivery:", "📍 Você está a uns $1 km. Entrega:", "📍 Sei a circa $1 km. Consegna:"]],
    [/^📍 Estás a unos (.+) km, fuera de nuestra zona de delivery \(hasta (.+) km\)\. Puedes enviar tu pedido y te confirmamos el costo por WhatsApp\.$/, ["📍 You're about $1 km away, outside our delivery area (up to $2 km). You can send your order and we'll confirm the cost on WhatsApp.", "📍 Você está a uns $1 km, fora da nossa área de entrega (até $2 km). Pode enviar seu pedido e confirmamos o custo pelo WhatsApp.", "📍 Sei a circa $1 km, fuori dalla nostra zona di consegna (fino a $2 km). Puoi inviare l'ordine e ti confermiamo il costo su WhatsApp."]],
  ];

  /* ---------- Traducir un texto ---------- */
  function nucleo(s, prof) {
    const e = D[s];
    if (e) return e[COL[id]];
    for (const [re, out] of P) {
      const m = re.exec(s);
      if (!m) continue;
      if (typeof out === "function") return out(m);
      return out[COL[id]].replace(/\$(\d)/g, (_, n) => { const x = m[Number(n)] || ""; const t = prof < 2 ? nucleo(x, 2) : null; return t == null ? x : t; });
    }
    // Frases unidas ("Cerrado… Puedes…") o partes con " · ": se traduce cada parte que se conozca
    if (prof < 1) {
      const formas = [[s.replace(/([.!?])\s+/g, "$1\u0000").split("\u0000"), " "], [s.split(" · "), " · "]];
      for (const [partes, union] of formas) {
        if (partes.length < 2) continue;
        let alguna = false;
        const out = partes.map((x) => { const r = nucleo(x, 1); if (r != null) { alguna = true; return r; } return x; });
        if (alguna) return out.join(union);
      }
    }
    return null;
  }
  function t(texto) {
    if (id === "es" || texto == null) return texto;
    const s = String(texto);
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    if (!m[2]) return s;
    const r = nucleo(m[2], 0);
    return r == null ? s : m[1] + r + m[3];
  }
  EU.t = t;

  /* ---------- Lo que escribió el dueño: nombres y descripciones en otros idiomas ---------- */
  EU.traducirContenido = function (c) {
    if (id === "es" || !c) return c;
    const recorrer = (x, prof) => {
      if (!x || typeof x !== "object" || prof > 6) return;
      if (Array.isArray(x)) { x.forEach((y) => recorrer(y, prof + 1)); return; }
      const tr = x.i18n && x.i18n[id];
      if (tr && typeof tr === "object") {
        ["nombre", "desc", "descripcion", "detalle"].forEach((k) => { const v = String(tr[k] || "").trim(); if (v && typeof x[k] === "string") x[k] = v; });
      }
      Object.keys(x).forEach((k) => { if (k !== "i18n") recorrer(x[k], prof + 1); });
    };
    recorrer(c, 0);
    return c;
  };

  /* ---------- Traducir la página (y lo que aparezca después) ---------- */
  if (id === "es") return;
  const ATR = ["placeholder", "aria-label", "title", "alt"];
  const SALTAR = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "NOSCRIPT", "OPTION"]);
  const puesto = new WeakMap(); // lo que ya pusimos, para no traducir dos veces
  function texto(n) {
    const p = n.parentNode;
    if (!p || SALTAR.has(p.nodeName) || (p.closest && p.closest("[data-no-traducir]"))) return;
    const v = n.nodeValue;
    if (puesto.get(n) === v) return;
    const r = t(v);
    if (r !== v) { puesto.set(n, r); n.nodeValue = r; }
  }
  function atributos(el) {
    if (el.closest && el.closest("[data-no-traducir]")) return;
    ATR.forEach((a) => {
      if (!el.hasAttribute || !el.hasAttribute(a)) return;
      const v = el.getAttribute(a), r = t(v);
      if (r !== v) el.setAttribute(a, r);
    });
  }
  function aplicar(raiz) {
    if (!raiz) return;
    if (raiz.nodeType === 3) { texto(raiz); return; }
    if (raiz.nodeType !== 1 || SALTAR.has(raiz.nodeName)) return;
    atributos(raiz);
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) texto(n); else atributos(n); }
  }
  EU.traducirPagina = aplicar;
  aplicar(document.body);
  new MutationObserver((ms) => {
    ms.forEach((m) => {
      if (m.type === "childList") m.addedNodes.forEach(aplicar);
      else if (m.type === "characterData") texto(m.target);
      else if (m.type === "attributes") atributos(m.target);
    });
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATR });
})();
