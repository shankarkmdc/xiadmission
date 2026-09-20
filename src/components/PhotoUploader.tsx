import React, { useRef, useState } from 'react';
import { Camera, Upload, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface PhotoUploaderProps {
  value: string; // base64
  onChange: (base64: string) => void;
  required?: boolean;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({ value, onChange, required = true }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const TARGET_WIDTH = 240;
  const TARGET_HEIGHT = 300;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate type
    if (!file.type.startsWith('image/')) {
      setError('অনুগ্রহ করে শুধুমাত্র ছবি ফাইল (JPG, JPEG, PNG) নির্বাচন করুন।');
      return;
    }

    // Validate size (max 2MB raw, we resize to exact 240x300)
    if (file.size > 2 * 1024 * 1024) {
      setError('ছবির আকার সর্বোচ্চ ২ মেগাবাইট হতে পারবে।');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Crop and resize to 240x300 using Canvas
          const canvas = document.createElement('canvas');
          canvas.width = TARGET_WIDTH;
          canvas.height = TARGET_HEIGHT;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            setError('ছবি প্রসেসিংয়ে সমস্যা হয়েছে।');
            setIsProcessing(false);
            return;
          }

          // Smart center-crop to fit 240:300 (4:5) aspect ratio
          const targetAspect = TARGET_WIDTH / TARGET_HEIGHT;
          const imgAspect = img.width / img.height;

          let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

          if (imgAspect > targetAspect) {
            // Image is wider than 4:5
            sWidth = img.height * targetAspect;
            sx = (img.width - sWidth) / 2;
          } else {
            // Image is taller than 4:5
            sHeight = img.width / targetAspect;
            sy = (img.height - sHeight) / 2;
          }

          // Fill white background just in case of PNG transparency
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

          // Get optimized base64
          const processedBase64 = canvas.toDataURL('image/jpeg', 0.92);
          onChange(processedBase64);
          setIsProcessing(false);
        } catch (err) {
          console.error(err);
          setError('ছবি রূপান্তরে ত্রুটি হয়েছে।');
          setIsProcessing(false);
        }
      };

      img.onerror = () => {
        setError('ছবি লোড করা সম্ভব হয়নি।');
        setIsProcessing(false);
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError(null);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
      {/* Photo Frame with 240x300 aspect ratio */}
      <div className="relative group shrink-0">
        <div
          className="w-36 h-44 rounded-lg overflow-hidden border-2 border-dashed border-emerald-500 bg-white flex flex-col items-center justify-center shadow-sm relative"
          style={{ width: '135px', height: '170px' }} // Exact 240:300 aspect ratio preview
        >
          {value ? (
            <>
              <img
                src={value}
                alt="শিক্ষার্থীর ছবি"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 shadow"
                  title="ছবি পরিবর্তন করুন"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-1.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow"
                  title="ছবি মুছুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="text-center p-3 flex flex-col items-center justify-center text-slate-400">
              <Camera className="w-8 h-8 mb-1.5 text-slate-400" />
              <span className="text-[11px] font-semibold text-slate-600">ছবি আপলোড</span>
              <span className="text-[10px] text-slate-400 font-mono">২৪০ x ৩০০ px</span>
            </div>
          )}
        </div>

        {value && (
          <span className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-1 rounded-full shadow">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </span>
        )}
      </div>

      {/* Instructions and Upload Button */}
      <div className="flex-1 text-center sm:text-left space-y-2">
        <div className="flex items-center justify-center sm:justify-start gap-1.5">
          <label className="text-sm font-bold text-slate-800">
            শিক্ষার্থীর পাসপোর্ট সাইজ ছবি {required && <span className="text-rose-600">*</span>}
          </label>
          <span className="text-[11px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
            ২৪০ x ৩০০ পিক্সেল
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          ছবিটি অবশ্যই সাম্প্রতিক রঙিন পাসপোর্ট সাইজ হতে হবে। সাদা বা হালকা ব্যাকগ্রাউন্ডের ছবি অগ্রাধিকার পাবে। ছবি আপলোড করলে তা স্বয়ংক্রিয়ভাবে ২৪০x৩০০ পিক্সেল সাইজে প্রসেস ও প্রিভিউ হবে।
        </p>

        <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            onChange={handleFileChange}
            className="hidden"
            id="student-photo-file-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Upload className="w-3.5 h-3.5" />
            {value ? 'ছবি পরিবর্তন করুন' : 'ছবি নির্বাচন করুন'}
          </button>
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded-lg text-xs font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              মুছুন
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 pt-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
