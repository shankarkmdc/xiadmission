import React, { useEffect } from 'react';
import { StudyGroup } from '../types';
import { BookOpen, Check, AlertTriangle, Info } from 'lucide-react';

interface SubjectSelectionState {
  compulsory: string[];
  elective4: string;
  elective5: string;
  elective6: string;
  optional7: string;
}

interface SubjectSelectorProps {
  group: StudyGroup;
  values: SubjectSelectionState;
  onChange: (updated: SubjectSelectionState) => void;
}

export const SubjectSelector: React.FC<SubjectSelectorProps> = ({ group, values, onChange }) => {
  // Ensure default compulsory subjects are set
  useEffect(() => {
    if (
      !values.compulsory ||
      values.compulsory.length !== 3 ||
      values.compulsory[0] !== 'বাংলা'
    ) {
      onChange({
        ...values,
        compulsory: ['বাংলা', 'ইংরেজি', 'তথ্য ও যোগাযোগ প্রযুক্তি'],
      });
    }
  }, []);

  // Handle defaults when group changes
  useEffect(() => {
    if (group === 'SCIENCE') {
      onChange({
        ...values,
        elective4: 'পদার্থ বিজ্ঞান',
        elective5: 'রসায়ন',
        elective6: values.elective6 === 'জীব বিজ্ঞান' || values.elective6 === 'উচ্চতর গণিত' ? values.elective6 : 'জীব বিজ্ঞান',
        optional7:
          values.optional7 && values.optional7 !== values.elective6
            ? values.optional7
            : values.elective6 === 'জীব বিজ্ঞান'
            ? 'উচ্চতর গণিত'
            : 'জীব বিজ্ঞান',
      });
    } else if (group === 'BUSINESS STUDIES') {
      onChange({
        ...values,
        elective4: 'হিসাববিজ্ঞান',
        elective5: 'ব্যবসায় ব্যবস্থাপনা',
        elective6:
          values.elective6 === 'উৎপাদন ব্যবস্থাপনা ও বিপণন' || values.elective6 === 'ফিন্যান্স, ব্যাংকিং ও বীমা'
            ? values.elective6
            : 'উৎপাদন ব্যবস্থাপনা ও বিপণন',
        optional7: values.optional7 === 'কৃষি শিক্ষা' || values.optional7 === 'পরিসংখ্যান' ? values.optional7 : 'কৃষি শিক্ষা',
      });
    } else if (group === 'HUMANITIES') {
      onChange({
        ...values,
        elective4:
          values.elective4 === 'ইসলামের ইতিহাস ও সংস্কৃতি' || values.elective4 === 'যুক্তিবিদ্যা'
            ? values.elective4
            : 'ইসলামের ইতিহাস ও সংস্কৃতি',
        elective5:
          values.elective5 === 'পৌরনীতি ও সুশাসন' || values.elective5 === 'অর্থনীতি'
            ? values.elective5
            : 'পৌরনীতি ও সুশাসন',
        elective6:
          values.elective6 === 'সমাজকর্ম' || values.elective6 === 'সমাজ বিজ্ঞান'
            ? values.elective6
            : 'সমাজকর্ম',
        optional7: values.optional7 === 'কৃষি শিক্ষা' || values.optional7 === 'পরিসংখ্যান' ? values.optional7 : 'কৃষি শিক্ষা',
      });
    }
  }, [group]);

  const handleElective6Change = (val: string) => {
    let nextOptional = values.optional7;
    // For science, if 7 is same as new 6, switch 7 to a valid alternative
    if (group === 'SCIENCE') {
      if (nextOptional === val) {
        if (val === 'জীব বিজ্ঞান') {
          nextOptional = 'উচ্চতর গণিত';
        } else if (val === 'উচ্চতর গণিত') {
          nextOptional = 'জীব বিজ্ঞান';
        }
      }
    }
    onChange({
      ...values,
      elective6: val,
      optional7: nextOptional,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Compulsory Subjects (আবশ্যিক বিষয়সমূহ) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-emerald-600" />
          <h4 className="text-sm font-bold text-slate-800">
            ১. আবশ্যিক বিষয় সমূহ (সবার জন্য বাধ্যতামূলক):
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-emerald-200 rounded-lg p-3 flex items-center gap-2 shadow-xs">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
              ১
            </span>
            <span className="text-sm font-semibold text-slate-800">বাংলা</span>
            <span className="ml-auto text-emerald-600">
              <Check className="w-4 h-4" />
            </span>
          </div>
          <div className="bg-white border border-emerald-200 rounded-lg p-3 flex items-center gap-2 shadow-xs">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
              ২
            </span>
            <span className="text-sm font-semibold text-slate-800">ইংরেজি</span>
            <span className="ml-auto text-emerald-600">
              <Check className="w-4 h-4" />
            </span>
          </div>
          <div className="bg-white border border-emerald-200 rounded-lg p-3 flex items-center gap-2 shadow-xs">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
              ৩
            </span>
            <span className="text-sm font-semibold text-slate-800">তথ্য ও যোগাযোগ প্রযুক্তি</span>
            <span className="ml-auto text-emerald-600">
              <Check className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>

      {/* 2. Elective Subjects (নির্বাচনিক বিষয়সমূহ) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-800">
              ২. নির্বাাচনিক বিষয় সমূহ (বিভাগ: {group}):
            </h4>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded">
            ৩টি বিষয়
          </span>
        </div>

        {/* HUMANITIES GROUP */}
        {group === 'HUMANITIES' && (
          <div className="space-y-4">
            {/* Subject 4 */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                ৪ নম্বর বিষয় (যেকোন একটি নির্বাচন করুন):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {['ইসলামের ইতিহাস ও সংস্কৃতি', 'যুক্তিবিদ্যা'].map((sub) => (
                  <label
                    key={sub}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium cursor-pointer transition ${
                      values.elective4 === sub
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="elective4"
                      checked={values.elective4 === sub}
                      onChange={() => onChange({ ...values, elective4: sub })}
                      className="text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>{sub}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Subject 5 */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                ৫ নম্বর বিষয় (যেকোন একটি নির্বাচন করুন):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {['পৌরনীতি ও সুশাসন', 'অর্থনীতি'].map((sub) => (
                  <label
                    key={sub}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium cursor-pointer transition ${
                      values.elective5 === sub
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="elective5"
                      checked={values.elective5 === sub}
                      onChange={() => onChange({ ...values, elective5: sub })}
                      className="text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>{sub}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Subject 6 */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                ৬ নম্বর বিষয় (যেকোন একটি নির্বাচন করুন):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {['সমাজকর্ম', 'সমাজ বিজ্ঞান'].map((sub) => (
                  <label
                    key={sub}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium cursor-pointer transition ${
                      values.elective6 === sub
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="elective6"
                      checked={values.elective6 === sub}
                      onChange={() => onChange({ ...values, elective6: sub })}
                      className="text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>{sub}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SCIENCE GROUP */}
        {group === 'SCIENCE' && (
          <div className="space-y-4">
            {/* Subject 4 (Fixed) */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase block">৪ নম্বর বিষয় (বাধ্যতামূলক):</span>
                <span className="text-sm font-bold text-slate-800">পদার্থ বিজ্ঞান</span>
              </div>
              <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                নির্দিষ্ট (বিকল্প নেই)
              </span>
            </div>

            {/* Subject 5 (Fixed) */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase block">৫ নম্বর বিষয় (বাধ্যতামূলক):</span>
                <span className="text-sm font-bold text-slate-800">রসায়ন</span>
              </div>
              <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                নির্দিষ্ট (বিকল্প নেই)
              </span>
            </div>

            {/* Subject 6 */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                ৬ নম্বর বিষয় (যেকোন একটি নির্বাচন করুন):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {['জীব বিজ্ঞান', 'উচ্চতর গণিত'].map((sub) => (
                  <label
                    key={sub}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium cursor-pointer transition ${
                      values.elective6 === sub
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="elective6_sci"
                      checked={values.elective6 === sub}
                      onChange={() => handleElective6Change(sub)}
                      className="text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>{sub}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BUSINESS STUDIES GROUP */}
        {group === 'BUSINESS STUDIES' && (
          <div className="space-y-4">
            {/* Subject 4 (Fixed) */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase block">৪ নম্বর বিষয় (বাধ্যতামূলক):</span>
                <span className="text-sm font-bold text-slate-800">হিসাববিজ্ঞান</span>
              </div>
              <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                নির্দিষ্ট (বিকল্প নেই)
              </span>
            </div>

            {/* Subject 5 (Fixed) */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase block">৫ নম্বর বিষয় (বাধ্যতামূলক):</span>
                <span className="text-sm font-bold text-slate-800">ব্যবসায় ব্যবস্থাপনা</span>
              </div>
              <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                নির্দিষ্ট (বিকল্প নেই)
              </span>
            </div>

            {/* Subject 6 */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                ৬ নম্বর বিষয় (যেকোন একটি নির্বাচন করুন):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {['উৎপাদন ব্যবস্থাপনা ও বিপণন', 'ফিন্যান্স, ব্যাংকিং ও বীমা'].map((sub) => (
                  <label
                    key={sub}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium cursor-pointer transition ${
                      values.elective6 === sub
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="elective6_bus"
                      checked={values.elective6 === sub}
                      onChange={() => onChange({ ...values, elective6: sub })}
                      className="text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>{sub}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Optional Subject (ঐচ্ছিক বিষয় / ৭ম বিষয়) */}
      <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 border-b border-amber-200/60 pb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-700" />
            <h4 className="text-sm font-bold text-slate-800">
              ৩. ঐচ্ছিক বিষয় (৪র্থ বিষয় - ৭ নম্বর বিষয় নির্বাচন):
            </h4>
          </div>
          <span className="text-xs bg-amber-200 text-amber-900 font-semibold px-2 py-0.5 rounded">
            ১টি বিষয়
          </span>
        </div>

        {/* HUMANITIES Optional */}
        {group === 'HUMANITIES' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {['কৃষি শিক্ষা', 'পরিসংখ্যান'].map((sub) => (
              <label
                key={sub}
                className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium cursor-pointer transition ${
                  values.optional7 === sub
                    ? 'border-amber-600 bg-amber-100/70 text-amber-950 shadow-xs'
                    : 'border-amber-200/80 bg-white hover:bg-amber-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="optional7_hum"
                  checked={values.optional7 === sub}
                  onChange={() => onChange({ ...values, optional7: sub })}
                  className="text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span>{sub}</span>
              </label>
            ))}
          </div>
        )}

        {/* SCIENCE Optional */}
        {group === 'SCIENCE' && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-100/70 p-2 rounded-md mb-2">
              <Info className="w-4 h-4 shrink-0 text-amber-700" />
              <span>
                শর্ত: ৬ নম্বর বিষয় হিসাবে যেটি নির্বাচন করেছেন ({values.elective6 || 'বাছাই করুন'}), ৭ নম্বর ঐচ্ছিক বিষয় হিসাবে সেটি নির্বাচন করা যাবে না।
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {['উচ্চতর গণিত', 'জীব বিজ্ঞান', 'কৃষি শিক্ষা'].map((sub) => {
                const isForbidden = values.elective6 === sub;
                return (
                  <label
                    key={sub}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium transition ${
                      isForbidden
                        ? 'opacity-40 bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        : values.optional7 === sub
                        ? 'border-amber-600 bg-amber-100/70 text-amber-950 shadow-xs cursor-pointer'
                        : 'border-amber-200/80 bg-white hover:bg-amber-50 text-slate-700 cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="optional7_sci"
                      disabled={isForbidden}
                      checked={values.optional7 === sub && !isForbidden}
                      onChange={() => !isForbidden && onChange({ ...values, optional7: sub })}
                      className="text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <div className="flex flex-col">
                      <span>{sub}</span>
                      {isForbidden && (
                        <span className="text-[10px] text-rose-600 font-normal">
                          (৬ নম্বরে নির্বাচিত)
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* BUSINESS STUDIES Optional */}
        {group === 'BUSINESS STUDIES' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {['কৃষি শিক্ষা', 'পরিসংখ্যান'].map((sub) => (
              <label
                key={sub}
                className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium cursor-pointer transition ${
                  values.optional7 === sub
                    ? 'border-amber-600 bg-amber-100/70 text-amber-950 shadow-xs'
                    : 'border-amber-200/80 bg-white hover:bg-amber-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="optional7_bus"
                  checked={values.optional7 === sub}
                  onChange={() => onChange({ ...values, optional7: sub })}
                  className="text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span>{sub}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Summary Chips */}
      <div className="bg-slate-100/80 rounded-lg p-3 text-xs flex flex-wrap items-center gap-1.5 text-slate-700 border border-slate-200">
        <span className="font-bold text-slate-800">মোট নির্বাচিত বিষয়সমূহ (৭টি):</span>
        <span className="bg-white px-2 py-0.5 rounded border border-slate-300 font-medium">১. বাংলা</span>
        <span className="bg-white px-2 py-0.5 rounded border border-slate-300 font-medium">২. ইংরেজি</span>
        <span className="bg-white px-2 py-0.5 rounded border border-slate-300 font-medium">৩. আইসিটি</span>
        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
          ৪. {values.elective4 || '...'}
        </span>
        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
          ৫. {values.elective5 || '...'}
        </span>
        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
          ৬. {values.elective6 || '...'}
        </span>
        <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300 font-semibold">
          ৭. {values.optional7 || '...'} (৪র্থ বিষয়)
        </span>
      </div>
    </div>
  );
};
