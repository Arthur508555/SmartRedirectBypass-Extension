// Work.ink Redirect Bypass - Popup Script

document.addEventListener('DOMContentLoaded', () => {
  // ===== ELEMENTOS =====
  const targetUrl = document.getElementById('targetUrl');
  const refererSelect = document.getElementById('refererSelect');
  const customReferer = document.getElementById('customReferer');
  const customRefererGroup = document.getElementById('customRefererGroup');
  const redirectBtn = document.getElementById('redirectBtn');
  const copyBtn = document.getElementById('copyBtn');
  const injectEvasion = document.getElementById('injectEvasion');
  const clearFlags = document.getElementById('clearFlags');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  const logSection = document.getElementById('logSection');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const toast = document.getElementById('toast');
  
  let currentTabId = null;
  let currentTabUrl = '';
  
  // ===== FUNÇÕES =====
  
  function addLog(message, type = 'info') {
    const div = document.createElement('div');
    div.textContent = '> ' + message;
    div.className = type;
    logSection.appendChild(div);
    logSection.scrollTop = logSection.scrollHeight;
  }
  
  function setStatus(text, type = 'ready') {
    statusText.textContent = text;
    statusDot.className = 'status-dot ' + type;
  }
  
  function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    setTimeout(() => {
      toast.className = 'toast ' + type;
    }, 3000);
  }
  
  function loadHistory() {
    chrome.storage.local.get(['redirectHistory'], (result) => {
      const history = result.redirectHistory || [];
      renderHistory(history);
    });
  }
  
  function renderHistory(history) {
    if (history.length === 0) {
      historyList.innerHTML = '<div class="no-history">No redirects performed yet</div>';
      return;
    }
    
    historyList.innerHTML = '';
    // Mostrar mais recentes primeiro
    const reversed = [...history].reverse();
    
    reversed.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'history-item';
      
      const urlSpan = document.createElement('span');
      urlSpan.className = 'url';
      urlSpan.title = item.url;
      urlSpan.textContent = item.url;
      
      const timeSpan = document.createElement('span');
      timeSpan.className = 'time';
      const date = new Date(item.timestamp);
      timeSpan.textContent = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      div.appendChild(urlSpan);
      div.appendChild(timeSpan);
      
      // Clicar no histórico preenche o campo
      div.addEventListener('click', () => {
        targetUrl.value = item.url;
        targetUrl.classList.add('success');
        setTimeout(() => targetUrl.classList.remove('success'), 2000);
        addLog('URL loaded from history: ' + item.url, 'info');
      });
      
      historyList.appendChild(div);
    });
  }
  
  function saveToHistory(url, referer) {
    chrome.storage.local.get(['redirectHistory'], (result) => {
      let history = result.redirectHistory || [];
      
      // Adicionar ao início (mais recente)
      history.push({
        url: url,
        referer: referer,
        timestamp: Date.now()
      });
      
      // Manter no máximo 20 itens
      if (history.length > 20) {
        history = history.slice(-20);
      }
      
      chrome.storage.local.set({ redirectHistory: history }, () => {
        renderHistory(history);
      });
    });
  }
  
  // ===== OBTER ABA ATUAL =====
  
  function getCurrentTab() {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' }, (response) => {
      if (response && response.tabId) {
        currentTabId = response.tabId;
        currentTabUrl = response.url || '';
        addLog('Current tab: ' + (currentTabUrl || 'unknown'), 'info');
        
        // Verificar se está em uma página de keysystem
        if (currentTabUrl && (
            currentTabUrl.includes('work.ink') || 
            currentTabUrl.includes('workink') ||
            currentTabUrl.includes('lootlabs') ||
            currentTabUrl.includes('linkvertise'))) {
          setStatus('📌 Key system page detected! Ready to redirect.', 'ready');
          addLog('✅ Key system detected: ' + currentTabUrl, 'info');
        } else {
          setStatus('✅ Ready to redirect', 'ready');
        }
      } else {
        addLog('⚠️ Could not retrieve the current tab', 'warn');
        setStatus('⚠️ Error retrieving tab', 'error');
      }
    });
  }
  
  // ===== MOSTRAR/ESCONDER REFERER CUSTOMIZADO =====
  
  refererSelect.addEventListener('change', () => {
    if (refererSelect.value === 'custom') {
      customRefererGroup.style.display = 'block';
    } else {
      customRefererGroup.style.display = 'none';
    }
  });
  
  // ===== BOTÃO COPIAR URL =====
  
  copyBtn.addEventListener('click', () => {
    if (currentTabUrl) {
      navigator.clipboard.writeText(currentTabUrl).then(() => {
        showToast('Tab URL copied!', 'success');
        addLog('URL copied: ' + currentTabUrl, 'info');
      }).catch(() => {
        // Fallback
        targetUrl.value = currentTabUrl;
        showToast('URL pasted into input field', 'success');
      });
    } else {
      showToast('No tab detected', 'error');
    }
  });
  
  // ===== BOTÃO REDIRECIONAR =====
  
  redirectBtn.addEventListener('click', async () => {
    const url = targetUrl.value.trim();
    
    // Validação
    if (!url) {
      targetUrl.classList.add('error');
      showToast('Paste the final URL first!', 'error');
      setTimeout(() => targetUrl.classList.remove('error'), 2000);
      return;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      targetUrl.classList.add('error');
      showToast('Invalid URL! Must start with http:// or https://', 'error');
      setTimeout(() => targetUrl.classList.remove('error'), 2000);
      return;
    }
    
    if (!currentTabId) {
      showToast('No active tab found', 'error');
      return;
    }
    
    // Obter referer
    let referer = refererSelect.value;
    if (referer === 'custom') {
      referer = customReferer.value.trim();
      if (!referer) {
        showToast('Enter a custom Referer', 'error');
        return;
      }
    }
    
    // Desabilitar botão durante operação
    redirectBtn.disabled = true;
    redirectBtn.textContent = '⏳ Redirecting...';
    setStatus('🔄 Running smart redirect...', 'waiting');
    
    addLog('🚀 Starting redirect...', 'info');
    addLog('  Target URL: ' + url, 'info');
    addLog('  Referer: ' + referer, 'info');
    
    // PASSO 1: Limpar flags se ativado
    if (clearFlags.checked) {
      addLog('🧹 Clearing cookies/blacklist flags...', 'info');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: () => {
            // Limpar localStorage
            try {
              const keysToRemove = [];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.toLowerCase().includes('block') || 
                    key.toLowerCase().includes('ban') || 
                    key.toLowerCase().includes('blacklist') ||
                    key.toLowerCase().includes('flag') ||
                    key.toLowerCase().includes('anti') ||
                    key.toLowerCase().includes('cheat') ||
                    key.toLowerCase().includes('abuse') ||
                    key.toLowerCase().includes('bypass'))) {
                  keysToRemove.push(key);
                }
              }
              keysToRemove.forEach(k => localStorage.removeItem(k));
            } catch(e) {}
            
            // Limpar sessionStorage
            try {
              const sKeysToRemove = [];
              for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && (key.toLowerCase().includes('block') || 
                    key.toLowerCase().includes('flag') || 
                    key.toLowerCase().includes('ban'))) {
                  sKeysToRemove.push(key);
                }
              }
              sKeysToRemove.forEach(k => sessionStorage.removeItem(k));
            } catch(e) {}
          }
        });
        addLog('✅ Flags successfully cleared', 'info');
      } catch(e) {
        addLog('⚠️ Error clearing flags: ' + e.message, 'warn');
      }
    }
    
    // PASSO 2: Injetar evasão se ativado
    if (injectEvasion.checked) {
      addLog('🛡️ Injecting anti-detection evasion script...', 'info');
      try {
        await chrome.runtime.sendMessage({ 
          type: 'INJECT_EVASION', 
          tabId: currentTabId 
        });
        addLog('✅ Evasion injected', 'info');
      } catch(e) {
        addLog('⚠️ Error injecting evasion: ' + e.message, 'warn');
      }
    }
    
    // PASSO 3: Executar o redirecionamento
    addLog('↗️ Redirecting to: ' + url, 'info');
    
    chrome.runtime.sendMessage({ 
      type: 'PERFORM_REDIRECT', 
      tabId: currentTabId, 
      url: url, 
      referer: referer 
    }, (response) => {
      if (response && response.success) {
        addLog('✅ Redirect completed successfully!', 'info');
        setStatus('✅ Redirected! Anti-detection active.', 'ready');
        showToast('✅ Redirected with active evasion!', 'success');
        
        // Salvar no histórico
        saveToHistory(url, referer);
        
        targetUrl.classList.add('success');
        setTimeout(() => targetUrl.classList.remove('success'), 2000);
      } else {
        const errorMsg = response ? response.error : 'No response from background';
        addLog('❌ Error: ' + errorMsg, 'error');
        setStatus('❌ Redirect error', 'error');
        showToast('❌ ' + errorMsg, 'error');
      }
      
      // Reabilitar botão
      redirectBtn.disabled = false;
      redirectBtn.textContent = '↗ Redirect';
    });
  });
  
  // ===== BOTÃO LIMPAR HISTÓRICO =====
  
  clearHistoryBtn.addEventListener('click', () => {
    chrome.storage.local.set({ redirectHistory: [] }, () => {
      renderHistory([]);
      showToast('History cleared', 'success');
      addLog('🗑️ Redirect history cleared', 'info');
    });
  });
  
  // ===== VALIDAÇÃO EM TEMPO REAL =====
  
  targetUrl.addEventListener('input', () => {
    const url = targetUrl.value.trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      targetUrl.classList.remove('error');
      targetUrl.classList.add('success');
    } else if (url) {
      targetUrl.classList.add('error');
      targetUrl.classList.remove('success');
    } else {
      targetUrl.classList.remove('error', 'success');
    }
  });
  
  // ===== INICIALIZAÇÃO =====
  
  getCurrentTab();
  loadHistory();
  
  addLog('🔒 Extension loaded. Awaiting URL...', 'info');
  addLog('🛡️ Anti-detection active for Work.ink', 'info');
  
  // Atualizar aba atual a cada 3 segundos (caso o usuário mude de aba)
  setInterval(getCurrentTab, 3000);
});