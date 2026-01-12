import { useState, useEffect, useCallback, useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { FolderOpen, X, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2 } from 'lucide-react';
import './App.css';

function App() {
  const [images, setImages] = useState([]); // Stores file handles + blob URLs
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // MEMORY: Stores zoom state
  const zoomStates = useRef({});
  const transformRef = useRef(null);

  // 1. THE NEW SCANNING LOGIC (Browser Native)
  const handleOpenFolder = async () => {
    try {
      // Ask user to select a directory
      const dirHandle = await window.showDirectoryPicker();
      setLoading(true);
      setImages([]);
      zoomStates.current = {};

      const imageFiles = [];
      const allowedExt = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);

      // Recursive scanner function
      async function scanDirectory(handle) {
        for await (const entry of handle.values()) {
          if (entry.kind === 'file') {
            const ext = entry.name.split('.').pop().toLowerCase();
            if (allowedExt.has(ext)) {
              // We store the 'FileHandle', not the path string
              imageFiles.push({ handle: entry, name: entry.name });
            }
          } else if (entry.kind === 'directory') {
            await scanDirectory(entry);
          }
        }
      }

      await scanDirectory(dirHandle);
      
      // Process files to create displayable URLs
      // We process them in batches or on-demand in a real app, 
      // but for simplicity here we get the file objects now.
      const loadedImages = await Promise.all(
        imageFiles.map(async (item) => {
          const file = await item.handle.getFile();
          return {
            name: item.name,
            url: URL.createObjectURL(file), // Creates a local blob: link
            handle: item.handle
          };
        })
      );

      setImages(loadedImages);

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        alert("Your browser might not support local file access. Try Chrome, Edge, or Opera.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Cleanup Blob URLs when app closes to free memory
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.url));
    };
  }, [images]);

  // --- NAVIGATION LOGIC (Same as before) ---
  const saveCurrentState = () => {
    if (transformRef.current && selectedIndex !== null) {
      const { scale, positionX, positionY } = transformRef.current.instance.transformState;
      zoomStates.current[selectedIndex] = { scale, positionX, positionY };
    }
  };

  const handleNext = useCallback(() => {
    saveCurrentState();
    setSelectedIndex((prev) => (prev + 1 < images.length ? prev + 1 : prev));
  }, [images.length, selectedIndex]);

  const handlePrev = useCallback(() => {
    saveCurrentState();
    setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedIndex === null) return;
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') setSelectedIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, handleNext, handlePrev]);

  const initialState = (selectedIndex !== null && zoomStates.current[selectedIndex]) 
    ? zoomStates.current[selectedIndex] 
    : { scale: 1, positionX: 0, positionY: 0 };

  return (
    <div className="app-container">
      {/* --- NAVBAR --- */}
      <nav className="navbar">
        <div className="logo">
          <ImageIcon className="logo-icon" />
          <span>Lumina<span className="logo-accent">Gallery</span></span>
        </div>

        {/* Replaced Text Input with simple "Open" Button */}
        <button className="open-btn" onClick={handleOpenFolder} disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <FolderOpen size={18} />}
          <span>{loading ? "Scanning..." : "Open Folder"}</span>
        </button>

        <div className="status">{images.length > 0 ? `${images.length} Assets` : 'Offline'}</div>
      </nav>

      {/* --- GRID --- */}
      <main className="gallery-grid">
        {images.length === 0 && !loading && (
          <div className="empty-state">
            <h1>Your Canvas Awaits</h1>
            <p>Click "Open Folder" to authorize access to your local gallery.</p>
          </div>
        )}
        
        {images.map((img, index) => (
          <div key={index} className="gallery-card" onClick={() => setSelectedIndex(index)}>
            <div className="image-wrapper">
              <img src={img.url} alt="thumbnail" loading="lazy" />
              <div className="overlay"></div>
            </div>
          </div>
        ))}
      </main>

      {/* --- VIEWER --- */}
      {selectedIndex !== null && (
        <div className="viewer-backdrop">
          <button className="nav-btn prev" onClick={handlePrev} disabled={selectedIndex === 0}>
            <ChevronLeft size={40} />
          </button>
          
          <button className="nav-btn next" onClick={handleNext} disabled={selectedIndex === images.length - 1}>
            <ChevronRight size={40} />
          </button>

          <button className="close-btn" onClick={() => setSelectedIndex(null)}>
            <X size={24} />
          </button>

          <div className="viewer-content">
             <TransformWrapper
                key={selectedIndex} 
                ref={transformRef}
                initialScale={initialState.scale}
                initialPositionX={initialState.positionX}
                initialPositionY={initialState.positionY}
                minScale={0.5}
                maxScale={10} 
                centerOnInit={!zoomStates.current[selectedIndex]}
                wheel={{ step: 0.1 }}
              >
                {({ centerView }) => (
                  <TransformComponent wrapperClass="gpu-wrapper" contentClass="gpu-content">
                    <img 
                      src={images[selectedIndex].url} 
                      alt="Full View" 
                      className="gpu-image"
                      decoding="sync"
                      onLoad={() => {
                         if (!zoomStates.current[selectedIndex]) centerView(0.5);
                      }}
                    />
                  </TransformComponent>
                )}
              </TransformWrapper>
          </div>
          
          <div className="viewer-footer">
            <span>{selectedIndex + 1} / {images.length}</span>
            <span className="filename">{images[selectedIndex].name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;