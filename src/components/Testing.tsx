import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb } from 'pdf-lib';
import { Highlighter, Pen, Type, Moon, Sun } from 'lucide-react';

// Worker configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Types from your original code
type Point = { x: number; y: number };
type HighlightAnnotation = {
  type: 'highlight';
  page: number;
  start: Point;
  end: Point;
  color: string;
};
type DrawingAnnotation = {
  type: 'draw';
  page: number;
  points: Point[];
  color: string;
  width: number;
};
type TextAnnotation = {
  type: 'text';
  page: number;
  position: Point;
  text: string;
  color: string;
};
type Annotation = HighlightAnnotation | DrawingAnnotation | TextAnnotation;

interface PDFViewerProps {
  pdfUrl?: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfUrl = 'https://almsbe.xeventechnologies.com/api/s3/file/multiple_quizzes-(2).pdf',
}) => {
  // Add these state variables at the top of your component
  const [currentDrawing, setCurrentDrawing] = useState<Point[]>([]);
  const [currentHighlight, setCurrentHighlight] = useState<{
    start: Point;
    end: Point;
  } | null>(null);
  // const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // States from your original code
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);
  const [currentTool, setCurrentTool] = useState<
    'select' | 'draw' | 'highlight' | 'text'
  >('highlight');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [highlightInfo, setHighlightInfo] = useState<{
    start: Point;
    current: Point;
  } | null>(null);
  const [annotationColor, setAnnotationColor] = useState<string>('#FFFF00');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalText, setModalText] = useState<string>('');
  const [modalPosition, setModalPosition] = useState<Point | null>(null);

  // New state for overlay positioning
  const [overlayDimensions, setOverlayDimensions] = useState({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
  });

  // Update overlay dimensions when iframe loads or resizes
  useEffect(() => {
    const updateOverlayDimensions = () => {
      if (iframeRef.current) {
        const rect = iframeRef.current.getBoundingClientRect();
        setOverlayDimensions({
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
        });
      }
    };

    window.addEventListener('resize', updateOverlayDimensions);
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', updateOverlayDimensions);
    }

    return () => {
      window.removeEventListener('resize', updateOverlayDimensions);
      if (iframe) {
        iframe.removeEventListener('load', updateOverlayDimensions);
      }
    };
  }, []);

  // Update the mouse event handlers for real-time drawing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const point = { x, y };

      switch (currentTool) {
        case 'draw':
          setIsDrawing(true);
          setCurrentPath([point]);
          setCurrentDrawing([point]);
          break;
        case 'highlight':
          setHighlightInfo({ start: point, current: point });
          setCurrentHighlight({ start: point, end: point });
          break;
        case 'text':
          setModalPosition(point);
          setIsModalOpen(true);
          break;
      }
    },
    [currentTool]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const point = { x, y };

      if (currentTool === 'draw' && isDrawing) {
        setCurrentDrawing((prev) => [...prev, point]);
        setCurrentPath((prev) => [...prev, point]);
      }

      if (currentTool === 'highlight' && highlightInfo) {
        setCurrentHighlight((prev) => (prev ? { ...prev, end: point } : null));
        setHighlightInfo((prev) => (prev ? { ...prev, current: point } : null));
      }
    },
    [currentTool, isDrawing, highlightInfo]
  );

  const handleMouseUp = useCallback(() => {
    if (currentTool === 'draw' && isDrawing) {
      setAnnotations((prev) => [
        ...prev,
        {
          type: 'draw',
          page: 1,
          points: currentPath,
          color: annotationColor,
          width: 2,
        },
      ]);
      setIsDrawing(false);
      setCurrentPath([]);
    }

    if (currentTool === 'highlight' && highlightInfo) {
      setAnnotations((prev) => [
        ...prev,
        {
          type: 'highlight',
          page: 1,
          start: highlightInfo.start,
          end: highlightInfo.current,
          color: annotationColor,
        },
      ]);
      setHighlightInfo(null);
    }
  }, [currentTool, isDrawing, currentPath, highlightInfo, annotationColor]);

  const handleModalSubmit = useCallback(() => {
    if (modalText && modalPosition) {
      setAnnotations((prev) => [
        ...prev,
        {
          type: 'text',
          page: 1,
          position: modalPosition,
          text: modalText,
          color: annotationColor,
        },
      ]);
      setIsModalOpen(false);
      setModalText('');
      setModalPosition(null);
    }
  }, [modalText, modalPosition, annotationColor]);

  // Add these functions just before the return statement in the PDFViewer component

  const hexToRgb = (hex: string) => {
    // Remove the # if present
    hex = hex.replace('#', '');

    // Parse the hex values directly to RGB values between 0 and 1
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    return { r, g, b };
  };

  // Replace the existing transformCoordinates function with this improved version
  const transformCoordinates = (
    point: Point,
    overlayWidth: number,
    overlayHeight: number,
    pdfWidth: number,
    pdfHeight: number,
    scale: number = 1
  ) => {
    // Calculate the aspect ratios
    const overlayAspectRatio = overlayWidth / overlayHeight;
    const pdfAspectRatio = pdfWidth / pdfHeight;

    let scaledWidth = overlayWidth;
    let scaledHeight = overlayHeight;

    // Adjust for aspect ratio differences
    if (overlayAspectRatio > pdfAspectRatio) {
      scaledWidth = overlayHeight * pdfAspectRatio;
    } else {
      scaledHeight = overlayWidth / pdfAspectRatio;
    }

    // Calculate offsets to center the content
    const offsetX = (overlayWidth - scaledWidth) / 2;
    const offsetY = (overlayHeight - scaledHeight) / 2;

    // Adjust point coordinates
    const adjustedX = point.x - offsetX;
    const adjustedY = point.y - offsetY;

    // Transform to PDF coordinates
    return {
      x: (adjustedX / scaledWidth) * pdfWidth * scale,
      y: pdfHeight - (adjustedY / scaledHeight) * pdfHeight * scale,
    };
  };

  const downloadAnnotatedPDF = async () => {
    try {
      if (!overlayRef.current) return;

      // Get dimensions
      const overlayWidth = overlayRef.current.clientWidth;
      const overlayHeight = overlayRef.current.clientHeight;

      // Fetch and load PDF
      const existingPdfBytes = await fetch(pdfUrl).then((res) =>
        res.arrayBuffer()
      );
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const page = pdfDoc.getPages()[0];
      const { width: pdfWidth, height: pdfHeight } = page.getSize();

      // Calculate the scale factor based on the PDF's original dimensions
      const scale = Math.min(
        overlayWidth / pdfWidth,
        overlayHeight / pdfHeight
      );

      // Process annotations
      for (const annotation of annotations) {
        switch (annotation.type) {
          case 'highlight': {
            const color = hexToRgb(annotation.color);
            const start = transformCoordinates(
              annotation.start,
              overlayWidth,
              overlayHeight,
              pdfWidth,
              pdfHeight,
              scale
            );
            const end = transformCoordinates(
              annotation.end,
              overlayWidth,
              overlayHeight,
              pdfWidth,
              pdfHeight,
              scale
            );

            page.drawRectangle({
              x: Math.min(start.x, end.x),
              y: Math.min(start.y, end.y),
              width: Math.abs(end.x - start.x),
              height: Math.abs(end.y - start.y),
              color: rgb(color.r, color.g, color.b),
              opacity: 0.35,
            });
            break;
          }

          case 'text': {
            const color = hexToRgb(annotation.color);
            const position = transformCoordinates(
              annotation.position,
              overlayWidth,
              overlayHeight,
              pdfWidth,
              pdfHeight,
              scale
            );

            // Adjust text size based on PDF dimensions
            const textSize = (12 * pdfWidth) / overlayWidth;

            page.drawText(annotation.text, {
              x: position.x,
              y: position.y,
              size: textSize,
              color: rgb(color.r, color.g, color.b),
            });
            break;
          }

          case 'draw': {
            const color = hexToRgb(annotation.color);
            let lastPoint = null;

            for (const point of annotation.points) {
              const transformedPoint = transformCoordinates(
                point,
                overlayWidth,
                overlayHeight,
                pdfWidth,
                pdfHeight,
                scale
              );

              if (lastPoint) {
                page.drawLine({
                  start: lastPoint,
                  end: transformedPoint,
                  thickness: (annotation.width * pdfWidth) / overlayWidth,
                  color: rgb(color.r, color.g, color.b),
                });
              }
              lastPoint = transformedPoint;
            }
            break;
          }
        }
      }

      // Save and download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'annotated-document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading annotated PDF:', error);
    }
  };

  
  return (
    <div
      className={`w-full mx-auto p-4 transition-colors duration-300 ${
        isDarkTheme ? 'bg-gray-900 text-white' : 'bg-white text-black'
      }`}
    >
      {/* Theme Toggle */}
      <div className='absolute top-4 right-4'>
        <button
          onClick={() => setIsDarkTheme(!isDarkTheme)}
          className={`p-2 rounded-full ${
            isDarkTheme
              ? 'bg-gray-700 text-yellow-400'
              : 'bg-gray-200 text-gray-800'
          }`}
        >
          {isDarkTheme ? <Sun size={24} /> : <Moon size={24} />}
        </button>
      </div>

      {/* Main Container */}
      <div className='flex gap-4'>
        {/* PDF Viewer Container */}
        <div className='flex-grow relative'>
          {/* PDF IFrame */}
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className='w-full h-[calc(100vh-2rem)]'
            title='PDF Viewer'
          />

          {/* Annotation Overlay */}
          <div
            ref={overlayRef}
            className='absolute top-0 left-0 pointer-events-auto'
            style={{
              width: overlayDimensions.width,
              height: overlayDimensions.height,
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Render annotations here */}
            {annotations.map((annotation, index) => {
              switch (annotation.type) {
                case 'highlight':
                  return (
                    <div
                      key={index}
                      className='absolute'
                      style={{
                        left: Math.min(annotation.start.x, annotation.end.x),
                        top: Math.min(annotation.start.y, annotation.end.y),
                        width: Math.abs(annotation.end.x - annotation.start.x),
                        height: Math.abs(annotation.end.y - annotation.start.y),
                        backgroundColor: annotation.color,
                        opacity: 0.3,
                        pointerEvents: 'none',
                      }}
                    />
                  );
                case 'text':
                  return (
                    <div
                      key={index}
                      className='absolute'
                      style={{
                        left: annotation.position.x,
                        top: annotation.position.y,
                        color: annotation.color,
                        pointerEvents: 'none',
                      }}
                    >
                      {annotation.text}
                    </div>
                  );
                case 'draw':
                  return (
                    <svg
                      key={index}
                      className='absolute top-0 left-0'
                      style={{
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                      }}
                    >
                      <path
                        d={`M ${annotation.points
                          .map((p) => `${p.x},${p.y}`)
                          .join(' L ')}`}
                        stroke={annotation.color}
                        strokeWidth={annotation.width}
                        fill='none'
                      />
                    </svg>
                  );
              }
            })}
          </div>
        </div>

        {/* Toolbar */}
        <div
          className={`w-64 p-4 border rounded ${
            isDarkTheme
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-300'
          }`}
        >
          <h3 className='text-lg font-bold mb-4'>Tools</h3>

          <div className='flex flex-col gap-2 mb-4'>
            <button
              className={`px-3 py-2 rounded flex items-center gap-2 ${
                currentTool === 'highlight' ? 'bg-green-700' : 'bg-green-500'
              } text-white`}
              onClick={() => setCurrentTool('highlight')}
            >
              <Highlighter size={18} />
              Highlight
            </button>

            <button
              className={`px-3 py-2 rounded flex items-center gap-2 ${
                currentTool === 'draw' ? 'bg-purple-700' : 'bg-purple-500'
              } text-white`}
              onClick={() => setCurrentTool('draw')}
            >
              <Pen size={18} />
              Draw
            </button>

            <button
              className={`px-3 py-2 rounded flex items-center gap-2 ${
                currentTool === 'text' ? 'bg-blue-700' : 'bg-blue-500'
              } text-white`}
              onClick={() => setCurrentTool('text')}
            >
              <Type size={18} />
              Text
            </button>
          </div>

          <div className='mb-4'>
            <label className='block text-sm font-medium mb-1'>Color:</label>
            <input
              type='color'
              value={annotationColor}
              onChange={(e) => setAnnotationColor(e.target.value)}
              className='w-full h-10 rounded'
            />
          </div>

          <button
            className='w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600'
            onClick={() => setAnnotations([])}
          >
            Clear All
          </button>
          <button
            className='w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600'
            onClick={downloadAnnotatedPDF}
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* Text Annotation Modal */}
      {isModalOpen && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 w-96'>
            <h3 className='text-lg font-bold mb-4'>Add Text Annotation</h3>
            <textarea
              className='w-full h-32 border rounded p-2 mb-4'
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              placeholder='Enter your text...'
            />
            <div className='flex justify-end gap-2'>
              <button
                className='px-4 py-2 bg-gray-500 text-white rounded'
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className='px-4 py-2 bg-blue-500 text-white rounded'
                onClick={handleModalSubmit}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
