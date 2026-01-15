import React, { useState, useEffect, useMemo } from 'react';
import { Product, StoreData, ViewType, UserRole, CartItem } from './types.ts';
import { 
  Package, 
  PlusCircle, 
  LogOut, 
  Search, 
  Loader2,
  ChevronLeft,
  X,
  Plus,
  Minus,
  Settings as SettingsIcon,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Send,
  Printer,
  Info
} from 'lucide-react';

const App: React.FC = () => {
  const [storeCode, setStoreCode] = useState<string | null>(localStorage.getItem('current_store_code'));
  const [userRole, setUserRole] = useState<UserRole>((localStorage.getItem('user_role') as UserRole) || 'viewer');
  const [displayMode, setDisplayMode] = useState<'stock' | 'catalog'>(userRole === 'admin' ? 'stock' : 'catalog');
  const [data, setData] = useState<StoreData>({ code: '', products: [], sales: [] });
  const [view, setView] = useState('inventory' as ViewType);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODO');
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    if (storeCode) {
      const baseCode = 'POWERSPORT'; 
      const savedData = localStorage.getItem(`store_data_${baseCode}`);
      if (savedData) {
        setData(JSON.parse(savedData));
      } else {
        const newData = { code: baseCode, products: [], sales: [] };
        setData(newData);
        localStorage.setItem(`store_data_${baseCode}`, JSON.stringify(newData));
      }
    }
  }, [storeCode]);

  const saveData = (newData: StoreData) => {
    if (userRole === 'viewer') return; 
    setData(newData);
    localStorage.setItem(`store_data_POWERSPORT`, JSON.stringify(newData));
  };

  const handleLogin = (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode === 'POWERSPORT') {
      setStoreCode('POWERSPORT');
      setUserRole('admin');
      setDisplayMode('stock');
      localStorage.setItem('current_store_code', 'POWERSPORT');
      localStorage.setItem('user_role', 'admin');
    } else if (cleanCode === 'CATALOGO') {
      setStoreCode('CATALOGO');
      setUserRole('viewer');
      setDisplayMode('catalog');
      localStorage.setItem('current_store_code', 'CATALOGO');
      localStorage.setItem('user_role', 'viewer');
    } else {
      alert("Código de acceso inválido");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('current_store_code');
    localStorage.removeItem('user_role');
    setStoreCode(null);
    window.location.reload();
  };

  const parseCSV = (text: string) => {
    const rows = [];
    const lines = text.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cells = [];
      let cell = '';
      let inQuotes = false;
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { cells.push(cell.trim()); cell = ''; }
        else cell += char;
      }
      cells.push(cell.trim());
      rows.push(cells);
    }
    return rows;
  };

  const fixImageUrl = (url: string) => {
    if (!url) return '';
    const driveMatch = url.match(/(?:id=|\/d\/|folders\/)([a-zA-Z0-9_-]{25,})/);
    if (driveMatch && (url.includes('drive.google.com') || url.includes('docs.google.com'))) {
      return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
    return url;
  };

  const syncWithGoogleSheets = async () => {
    if (!data.sheetId) { 
      alert("Configura el ID de la planilla en Ajustes");
      return; 
    }
    setIsSyncing(true);
    try {
      let url = data.sheetId;
      if (url.includes('docs.google.com')) {
        const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
        if (idMatch) {
          url = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=0`;
        }
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const csvText = await response.text();
      const rows = parseCSV(csvText);
      const newProducts: Product[] = rows.map((cols, idx) => ({
        id: crypto.randomUUID(),
        brand: (cols[0] || 'N/A').toUpperCase(),
        name: (cols[1] || 'PRODUCTO').toUpperCase(),
        size: (cols[2] || 'N/A').toUpperCase(),
        color: (cols[3] || 'N/A').toUpperCase(),
        quantity: parseInt(cols[4]) || 0,
        price: parseFloat(cols[5]) || 0,
        cost: parseFloat(cols[6]) || 0,
        image: fixImageUrl(cols[7] || ''),
        category: (cols[8] || 'GENERAL').toUpperCase(),
        addedAt: Date.now() + idx
      }));
      saveData({ ...data, products: newProducts });
      alert("¡Catálogo Actualizado con Éxito!");
      setView('inventory');
    } catch (e) {
      alert("Error. Asegúrate de que el Excel esté 'Publicado en la Web' como CSV.");
    } finally {
      setIsSyncing(false);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    const updated = data.products.map(p => p.id === productId ? { ...p, quantity: Math.max(0, p.quantity + delta) } : p);
    saveData({ ...data, products: updated });
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(data.products.map(p => p.category.toUpperCase()))).filter(Boolean).sort();
    return ['TODO', ...cats];
  }, [data.products]);

  const filteredProducts = useMemo(() => {
    return data.products.filter(p => {
      if (displayMode === 'catalog' && p.quantity <= 0) return false;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'TODO' || p.category.toUpperCase() === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [data.products, searchQuery, selectedCategory, displayMode]);

  const addToCart = (productId: string) => {
    setCart(prev => {
      const exists = prev.find(i => i.productId === productId);
      if (exists) return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const cartTotal = cart.reduce((acc, item) => {
    const p = data.products.find(prod => prod.id === item.productId);
    return acc + (p ? p.price * item.quantity : 0);
  }, 0);

  if (!storeCode) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden max-w-5xl mx-auto text-white">
      <header className="no-print p-4 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 flex justify-between items-center z-50 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-600 rounded-xl flex items-center justify-center font-black italic shadow-lg shadow-pink-600/30 transform -rotate-3">PS</div>
          <div>
            <h1 className="text-sm font-black uppercase italic leading-none tracking-tighter">PowerSport</h1>
            <p className="text-[8px] text-pink-500 font-bold tracking-[0.2em] mt-1 uppercase">Tienda Oficial</p>
          </div>
        </div>
        <div className="flex gap-2">
          {userRole === 'admin' && (
            <button onClick={() => setView('settings')} className={`p-2.5 rounded-full transition-all ${view === 'settings' ? 'bg-pink-600 shadow-lg shadow-pink-600/40' : 'bg-white/5 hover:bg-white/10'}`}>
              <SettingsIcon className="w-4 h-4" />
            </button>
          )}
          <button onClick={handleLogout} className="p-2.5 bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {userRole === 'admin' && view === 'inventory' && (
        <div className="no-print px-4 py-2 bg-black flex gap-2 border-b border-white/5">
          <button onClick={() => setDisplayMode('stock')} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase italic border transition-all ${displayMode === 'stock' ? 'bg-white text-black' : 'text-slate-500 border-white/5'}`}>Gestión Interna</button>
          <button onClick={() => setDisplayMode('catalog')} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase italic border transition-all ${displayMode === 'catalog' ? 'bg-pink-600 text-white border-pink-600' : 'text-slate-500 border-white/5'}`}>Vista Cliente</button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto no-scrollbar p-2 pb-32 bg-gradient-to-b from-slate-950 to-black">
        {view === 'inventory' && (
          <>
            {displayMode === 'catalog' && (
              <div className="p-4 mb-4 rounded-[2rem] bg-gradient-to-br from-pink-600/20 to-transparent border border-pink-600/10 text-center space-y-2">
                <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Nuevos Ingresos</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Envíos a todo el país • Stock Real</p>
              </div>
            )}

            <div className="no-print space-y-4 mb-6 px-2">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-pink-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="¿Qué estás buscando?" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-medium focus:ring-1 focus:ring-pink-600 outline-none transition-all shadow-inner" 
                />
              </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {categories.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setSelectedCategory(cat)} 
                    className={`py-2.5 px-0.5 rounded-xl text-[8px] font-black uppercase italic border transition-all text-center truncate ${selectedCategory === cat ? 'bg-pink-600 border-pink-600 text-white shadow-lg shadow-pink-600/20' : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/20'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 px-1">
              {filteredProducts.map(p => (
                <div key={p.id} className="bg-slate-900/30 border border-white/5 rounded-2xl p-2 flex flex-col h-full hover:border-pink-600/30 transition-all">
                  <div className="aspect-square rounded-xl bg-black mb-2 overflow-hidden relative flex items-center justify-center border border-white/5">
                    <img 
                      src={p.image || 'https://via.placeholder.com/200?text=PS'} 
                      className="w-full h-full object-contain cursor-pointer active:scale-95 transition-transform" 
                      alt={p.name}
                      onClick={() => setFullscreenImage(p.image)} 
                    />
                    <div className="absolute top-1 left-1 bg-black/80 text-[6px] font-black px-1.5 py-0.5 rounded-full border border-white/10 uppercase italic text-white/80">{p.brand}</div>
                    <div className="absolute bottom-1 right-1 bg-pink-600 text-[6px] font-black px-1.5 py-0.5 rounded-lg text-white uppercase">T {p.size}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[9px] font-black uppercase italic truncate text-slate-100">{p.name}</h3>
                    <p className="text-[11px] font-black italic text-pink-500 mt-0.5">${p.price.toLocaleString()}</p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5">
                    {displayMode === 'stock' ? (
                      <div className="flex items-center justify-between bg-black/50 rounded-xl p-1">
                        <button onClick={() => updateQuantity(p.id, -1)} className="p-1 text-slate-500 hover:text-white"><Minus className="w-3 h-3" /></button>
                        <span className="text-[10px] font-black">{p.quantity}</span>
                        <button onClick={() => updateQuantity(p.id, 1)} className="p-1 text-slate-500 hover:text-white"><Plus className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(p.id)} className="w-full bg-pink-600 py-2 rounded-xl text-[8px] font-black uppercase italic shadow-lg shadow-pink-600/10 active:scale-95 transition-all">Comprar</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {filteredProducts.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6 text-slate-700" />
                </div>
                <p className="text-xs text-slate-500 font-bold uppercase italic">No encontramos lo que buscas</p>
              </div>
            )}
          </>
        )}

        {view === 'settings' && (
          <div className="p-6 space-y-8">
            <button onClick={() => setView('inventory')} className="text-[10px] font-black uppercase italic text-slate-500 flex items-center gap-2 hover:text-white"><ChevronLeft className="w-4 h-4" /> Volver al Inventario</button>
            <div className="bg-slate-900/50 p-8 rounded-[3rem] space-y-6 border border-white/10 shadow-2xl">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-pink-500">
                  <Info className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase italic">Configuración de Datos</span>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">Link de Google Sheets (CSV)</label>
                  <input type="text" value={data.sheetId || ''} onChange={e => setData({...data, sheetId: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xs font-medium text-white outline-none focus:border-pink-600" placeholder="Pega el link aquí..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-500 ml-1">WhatsApp para Pedidos</label>
                  <input type="text" value={data.whatsappNumber || ''} onChange={e => setData({...data, whatsappNumber: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xs font-medium text-white outline-none focus:border-pink-600" placeholder="Ej: 5493412345678" />
                </div>
              </div>
              <button onClick={syncWithGoogleSheets} disabled={isSyncing} className="w-full bg-pink-600 py-6 rounded-2xl font-black uppercase italic flex items-center justify-center gap-3 shadow-xl shadow-pink-600/20 active:scale-95 transition-all">
                {isSyncing ? <Loader2 className="w-6 h-6 animate-spin" /> : <RefreshCw className="w-6 h-6" />} 
                {isSyncing ? 'Procesando...' : 'Guardar y Sincronizar'}
              </button>
            </div>
          </div>
        )}
      </main>

      {displayMode === 'catalog' && cart.length > 0 && !showCart && (
        <button onClick={() => setShowCart(true)} className="fixed bottom-10 right-6 bg-pink-600 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-[60] border-4 border-black animate-bounce">
          <ShoppingCart className="w-7 h-7" />
          <span className="absolute -top-1 -right-1 bg-white text-pink-600 text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-pink-600">{cart.length}</span>
        </button>
      )}

      {showCart && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-end animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full rounded-t-[3.5rem] p-8 max-h-[90vh] flex flex-col shadow-2xl border-t border-white/10">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Mi Pedido</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase italic mt-1">Revisa tus productos antes de enviar</p>
              </div>
              <button onClick={() => setShowCart(false)} className="p-4 bg-white/5 rounded-full hover:bg-white/10"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
              {cart.map(item => {
                const p = data.products.find(prod => prod.id === item.productId);
                if (!p) return null;
                return (
                  <div key={item.productId} className="flex items-center gap-5 bg-black/40 p-4 rounded-3xl border border-white/5">
                    <img src={p.image} className="w-16 h-16 object-contain rounded-xl bg-black" alt="" />
                    <div className="flex-1">
                      <h4 className="text-[11px] font-black uppercase italic leading-none">{p.name}</h4>
                      <p className="text-[9px] font-bold text-pink-500 mt-2 italic uppercase">Talle {p.size} • ${p.price.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3 bg-black rounded-xl p-1">
                      <button onClick={() => setCart(prev => prev.map(i => i.productId === item.productId ? {...i, quantity: Math.max(1, i.quantity - 1)} : i))} className="p-1 text-slate-600"><Minus className="w-4 h-4" /></button>
                      <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                      <button onClick={() => setCart(prev => prev.map(i => i.productId === item.productId ? {...i, quantity: i.quantity + 1} : i))} className="p-1 text-slate-600"><Plus className="w-4 h-4" /></button>
                    </div>
                    <button onClick={() => setCart(prev => prev.filter(i => i.productId !== item.productId))} className="text-slate-800 hover:text-red-500 transition-colors ml-2"><Trash2 className="w-5 h-5" /></button>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 space-y-5 pt-8 border-t border-white/10">
              <div className="flex justify-between items-center px-4">
                <span className="text-xs uppercase font-black text-slate-500 italic">Total Estimado</span>
                <span className="text-4xl font-black italic text-pink-600 tracking-tighter">${cartTotal.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => window.print()} className="bg-white text-black py-5 rounded-2xl font-black uppercase italic text-[10px] flex items-center justify-center gap-2 active:scale-95"><Printer className="w-5 h-5" /> Generar PDF</button>
                <button onClick={() => {
                  const num = data.whatsappNumber;
                  if (!num) return alert("Error: No hay número configurado");
                  let msg = `*NUEVO PEDIDO POWERSPORT*\n\n`;
                  cart.forEach(i => { const p = data.products.find(pr => pr.id === i.productId); if(p) msg += `✅ ${p.brand} ${p.name}\n   Talle: ${p.size} | Cant: ${i.quantity}\n\n`; });
                  msg += `*TOTAL A PAGAR: $${cartTotal.toLocaleString()}*`;
                  window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
                }} className="bg-green-600 text-white py-5 rounded-2xl font-black uppercase italic text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 active:scale-95"><Send className="w-5 h-5" /> Enviar WhatsApp</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {userRole === 'admin' && (
        <nav className="no-print fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-2xl border-t border-white/10 py-4 px-10 flex justify-around items-center z-50">
          <button onClick={() => setView('inventory')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'inventory' ? 'text-pink-600 scale-110' : 'text-slate-600'}`}>
            <Package className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest italic">Inventario</span>
          </button>
          <div className="w-16 h-16 bg-pink-600 rounded-3xl -mt-12 flex items-center justify-center shadow-2xl shadow-pink-600/40 border-4 border-black active:scale-90 transition-all cursor-pointer">
            <PlusCircle className="w-8 h-8 text-white" />
          </div>
          <button onClick={() => setView('settings')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'settings' ? 'text-pink-600 scale-110' : 'text-slate-600'}`}>
            <SettingsIcon className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest italic">Ajustes</span>
          </button>
        </nav>
      )}

      {fullscreenImage && (
        <div className="fixed inset-0 bg-black/98 z-[200] flex items-center justify-center p-4" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl animate-in zoom-in duration-300" alt="" />
          <button className="absolute top-8 right-8 p-4 bg-white/10 rounded-full text-white"><X className="w-6 h-6" /></button>
        </div>
      )}
    </div>
  );
};

const LoginScreen = ({ onLogin }: any) => {
  const [code, setCode] = useState('');
  return (
    <div className="h-screen bg-black flex items-center justify-center p-8 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full bg-pink-600/10 blur-[150px] opacity-50"></div>
      <div className="w-full max-w-xs text-center space-y-12 relative z-10">
        <div className="space-y-4">
          <div className="w-28 h-28 bg-pink-600 rounded-[2.5rem] flex items-center justify-center text-6xl font-black italic rotate-6 mx-auto shadow-2xl shadow-pink-600/40 border-4 border-white/10">PS</div>
          <h1 className="text-4xl font-black uppercase italic leading-none text-white tracking-tighter">PowerSport</h1>
          <p className="text-[9px] font-black text-pink-500 uppercase tracking-[0.5em] opacity-80">SISTEMA INTEGRAL</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[8px] font-black text-slate-500 uppercase italic tracking-widest">Ingresa tu código de acceso</p>
            <input 
              type="text" 
              placeholder="••••••••" 
              value={code} 
              onChange={e => setCode(e.target.value.toUpperCase())} 
              className="w-full bg-white/5 border border-white/10 rounded-3xl py-6 text-center text-3xl font-black italic text-white focus:border-pink-600 focus:bg-white/10 transition-all outline-none shadow-2xl" 
            />
          </div>
          <button onClick={() => onLogin(code)} className="w-full bg-pink-600 py-6 rounded-3xl font-black uppercase italic text-white shadow-xl shadow-pink-600/30 active:scale-95 transition-all text-sm tracking-widest">Entrar al Sistema</button>
        </div>
      </div>
    </div>
  );
};

export default App;
