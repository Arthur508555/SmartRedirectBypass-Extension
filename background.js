// Work.ink Redirect Bypass - Background Service Worker

// ===== CONFIGURAÇÕES DE EVASÃO =====

// Headers que um navegador REAL envia quando redirecionado do Work.ink
const LEGITIMATE_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Referer': 'https://work.ink/',
  'Origin': 'https://work.ink'
};

// ===== ESTADO =====
let pendingRedirect = null;

// ===== LISTA DE REFERERS LEGÍTIMOS =====
const LEGITIMATE_REFERERS = [
  'https://work.ink/',
  'https://workink.click/',
  'https://redirect.work.ink/',
  'https://lootlabs.com/',
  'https://linkvertise.com/'
];

// ===== FUNÇÃO PRINCIPAL DE REDIRECIONAMENTO =====

async function performRedirect(tabId, realUrl, customReferer) {
  console.log('[Work.ink Redirect] Iniciando redirecionamento inteligente...');
  
  // 1. Primeiro, injetar um script na página para manipular o histórico
  //    e fazer parecer que o usuário sempre esteve no Work.ink
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (referer) => {
        // Manipular o histórico do navegador via sessionStorage
        try {
          sessionStorage.setItem('wk_redirect_source', 'legitimate');
          sessionStorage.setItem('wk_redirect_time', Date.now().toString());
          localStorage.setItem('wk_bypass_completed', 'true');
          localStorage.setItem('wk_bypass_timestamp', Date.now().toString());
        } catch(e) {}
        
        // Remover qualquer flag de anti-bypass que o site possa ter
        try {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('block') || key.includes('ban') || 
                key.includes('blacklist') || key.includes('flag') ||
                key.includes('anti') || key.includes('cheat') ||
                key.includes('abuse') || key.includes('bypass'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch(e) {}
      },
      args: [customReferer]
    });
  } catch(e) {
    console.warn('[Work.ink Redirect] Erro ao injetar script de preparação:', e.message);
  }
  
  // 2. Aguardar um momento para os storages serem atualizados
  await new Promise(r => setTimeout(r, 300));
  
  // 3. Fazer o redirect final com headers legítimos
  //    Usamos chrome.tabs.update com a URL e depois injetamos headers via webRequest
  //    na próxima navegação
  
  // Guardar URL pendente para o webRequest listener manipular os headers
  pendingRedirect = {
    url: realUrl,
    referer: customReferer || 'https://work.ink/',
    timestamp: Date.now()
  };
  
  // 4. Executar o redirect
  chrome.tabs.update(tabId, { url: realUrl });
  
  console.log('[Work.ink Redirect] Redirecionamento concluído para:', realUrl);
}

// ===== INTERCEPTAR REQUISIÇÕES PARA MANIPULAR HEADERS =====
// Isso faz com que a requisição pareça ter vindo do fluxo legítimo

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    // Verificar se temos um redirect pendente para esta URL
    if (pendingRedirect && details.url === pendingRedirect.url && 
        Date.now() - pendingRedirect.timestamp < 5000) {
      
      const headers = details.requestHeaders;
      
      // Modificar/adicionar headers para parecer legítimo
      const headerModifications = {
        'Referer': pendingRedirect.referer,
        'Origin': new URL(pendingRedirect.referer).origin,
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-User': '?1'
      };
      
      for (const [name, value] of Object.entries(headerModifications)) {
        const existing = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          existing.value = value;
        } else {
          headers.push({ name, value });
        }
      }
      
      // Limpar pendingRedirect após usar
      pendingRedirect = null;
      
      console.log('[Work.ink Redirect] Headers manipulados para parecer legítimo');
      
      return { requestHeaders: headers };
    }
    
    return { requestHeaders: details.requestHeaders };
  },
  { urls: ['<all_urls>'] },
  ['blocking', 'requestHeaders', 'extraHeaders']
);

// ===== INTERCEPTAR RESPOSTAS PARA REMOVER DETECÇÃO =====
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const url = details.url;
    const responseHeaders = details.responseHeaders || [];
    
    // Remover headers que podem conter flags de anti-bypass
    const filteredHeaders = responseHeaders.filter(header => {
      const name = header.name.toLowerCase();
      // Remover headers de segurança que podem bloquear o redirecionamento
      if (name === 'content-security-policy' || 
          name === 'x-content-security-policy' ||
          name === 'x-frame-options' ||
          name === 'permissions-policy') {
        return false;
      }
      return true;
    });
    
    // Modificar o header Timing-Allow-Origin para evitar detecção
    const timingHeader = filteredHeaders.find(h => h.name.toLowerCase() === 'timing-allow-origin');
    if (timingHeader) {
      timingHeader.value = '*';
    }
    
    return { responseHeaders: filteredHeaders };
  },
  { urls: ['<all_urls>'] },
  ['blocking', 'responseHeaders', 'extraHeaders']
);

// ===== RECEBER MENSAGENS DO POPUP =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PERFORM_REDIRECT') {
    const { tabId, url, referer } = message;
    
    if (!tabId || !url) {
      sendResponse({ success: false, error: 'Parâmetros incompletos' });
      return true;
    }
    
    // Executar o redirecionamento
    performRedirect(tabId, url, referer)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    
    return true; // Keep message channel open
  }
  
  if (message.type === 'GET_CURRENT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        sendResponse({ tabId: tabs[0].id, url: tabs[0].url });
      } else {
        sendResponse({ tabId: null, url: null });
      }
    });
    return true;
  }
  
  if (message.type === 'INJECT_EVASION') {
    // Injetar script de evasão na página atual
    const { tabId } = message;
    
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // === SCRIPT DE EVASÃO ANTI-DETECÇÃO ===
        
        // 1. Sobrescrever propriedades que detectam DevTools ou extensões
        Object.defineProperty(document, 'hidden', {
          get: () => false,
          configurable: false
        });
        
        Object.defineProperty(document, 'webkitHidden', {
          get: () => false,
          configurable: false
        });
        
        // 2. Sobrescrever Performance API para não mostrar timing suspeito
        if (window.performance && window.performance.now) {
          const origNow = window.performance.now.bind(window.performance);
          window.performance.now = function() {
            // Retornar um valor que parece natural
            return origNow() + Math.random() * 100;
          };
        }
        
        // 3. Bloquear detecção de cookies de rastreamento
        const origCookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
        Object.defineProperty(document, 'cookie', {
          get: function() {
            const cookies = origCookie.get.call(this);
            // Remover cookies de rastreamento/flag
            return cookies.split(';')
              .filter(c => {
                const trimmed = c.trim().toLowerCase();
                return !trimmed.includes('flag') && 
                       !trimmed.includes('ban') && 
                       !trimmed.includes('block') &&
                       !trimmed.includes('abuse') &&
                       !trimmed.includes('cheat');
              })
              .join('; ');
          },
          set: function(val) {
            // Bloquear cookies de flag
            if (val.toLowerCase().includes('flag') || 
                val.toLowerCase().includes('ban') ||
                val.toLowerCase().includes('block') ||
                val.toLowerCase().includes('abuse')) {
              console.log('[Work.ink Evasion] Cookie de flag bloqueado:', val);
              return;
            }
            origCookie.set.call(this, val);
          },
          configurable: false
        });
        
        // 4. Bloquear navigator.webdriver
        if (navigator.webdriver !== undefined) {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
            configurable: false
          });
        }
        
        // 5. Adicionar entradas falsas no histórico de navegação (sessionStorage)
        try {
          if (!sessionStorage.getItem('wk_evasion_active')) {
            sessionStorage.setItem('wk_evasion_active', 'true');
            sessionStorage.setItem('wk_evasion_time', Date.now().toString());
          }
        } catch(e) {}
        
        console.log('[Work.ink Evasion] Script de evasão injetado com sucesso!');
      }
    }).catch(e => {
      console.warn('[Work.ink Redirect] Erro ao injetar evasão:', e.message);
    });
    
    sendResponse({ success: true });
    return true;
  }
});

// ===== REGRAS DE NETWORK REQUEST PARA EVITAR DETECÇÃO =====
const EVASION_RULES = [
  {
    id: 1,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'Referer', operation: 'set', value: 'https://work.ink/' },
        { header: 'Origin', operation: 'set', value: 'https://work.ink' },
        { header: 'Sec-Fetch-Site', operation: 'set', value: 'cross-site' },
        { header: 'Sec-Fetch-Mode', operation: 'set', value: 'navigate' }
      ]
    },
    condition: {
      urlFilter: '||work.ink/',
      resourceTypes: ['main_frame', 'sub_frame']
    }
  }
];

// Registrar regras de evasão
chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: EVASION_RULES.map(r => r.id),
  addRules: EVASION_RULES
}).catch(e => console.warn('[Work.ink Redirect] Erro ao registrar regras:', e.message));

console.log('[Work.ink Redirect Bypass] Background service worker iniciado.');