import React, { useState } from 'react';
import { SaveSlotData, FranchiseSeasonState } from '../types/franchise';
import { getAllSaveSlots, saveToSlot, deleteSaveSlot, setActiveSlotId, getActiveSlotId, renameSaveSlot } from '../utils/saveManager';
import { getTeamById } from '../data/teams';
import { HardDrive, Play, Plus, Trash2, Check, Clock, Shield, Sparkles, X, Edit2, Save } from 'lucide-react';

interface SaveSlotManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSeason: FranchiseSeasonState | null;
  onLoadSlot: (season: FranchiseSeasonState) => void;
  onStartNewInSlot: (slotId: 1 | 2 | 3) => void;
  onDeleteActiveSlot?: () => void;
}

export const SaveSlotManagerModal: React.FC<SaveSlotManagerModalProps> = ({
  isOpen,
  onClose,
  currentSeason,
  onLoadSlot,
  onStartNewInSlot,
  onDeleteActiveSlot,
}) => {
  const [slots, setSlots] = useState<{ [key in 1 | 2 | 3]: SaveSlotData | null }>(getAllSaveSlots());
  const [deleteConfirmSlotId, setDeleteConfirmSlotId] = useState<1 | 2 | 3 | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<1 | 2 | 3 | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');
  const activeSlot = currentSeason?.slotId || getActiveSlotId();

  if (!isOpen) return null;

  const refreshSlots = () => {
    setSlots(getAllSaveSlots());
  };

  const handleStartRename = (slotId: 1 | 2 | 3, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSlotId(slotId);
    setEditingNameValue(currentName);
  };

  const handleSaveRename = (slotId: 1 | 2 | 3, e?: React.MouseEvent | React.FormEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (editingNameValue.trim()) {
      renameSaveSlot(slotId, editingNameValue.trim());
      refreshSlots();
    }
    setEditingSlotId(null);
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingSlotId(null);
  };

  const handleManualSaveCurrent = (slotId: 1 | 2 | 3) => {
    if (!currentSeason) return;
    const updated = { ...currentSeason, slotId };
    saveToSlot(slotId, updated);
    setActiveSlotId(slotId);
    refreshSlots();
  };

  const handleDeletePrompt = (slotId: 1 | 2 | 3, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteConfirmSlotId(slotId);
  };

  const handleConfirmPermanentDelete = () => {
    if (!deleteConfirmSlotId) return;
    const targetSlotId = deleteConfirmSlotId;
    deleteSaveSlot(targetSlotId);
    setSlots(getAllSaveSlots());
    setDeleteConfirmSlotId(null);

    if (currentSeason && (currentSeason.slotId === targetSlotId || activeSlot === targetSlotId)) {
      onDeleteActiveSlot?.();
    }
  };

  const handleSelectSlot = (slotData: SaveSlotData) => {
    setActiveSlotId(slotData.slotId);
    onLoadSlot(slotData.season);
    onClose();
  };

  const renderSlotCard = (slotId: 1 | 2 | 3) => {
    const slot = slots[slotId];
    const isCurrentActive = activeSlot === slotId;

    if (!slot) {
      return (
        <div
          key={slotId}
          className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-900/40 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 transition group"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-amber-400 group-hover:bg-slate-800/80 transition">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              SAVE SLOT #{slotId}
            </span>
            <h4 className="font-display font-black text-base text-slate-300">Empty Slot</h4>
            <p className="text-[11px] text-slate-500">No franchise save file recorded</p>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <button
              onClick={() => {
                onClose();
                onStartNewInSlot(slotId);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs shadow-md transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>NEW FRANCHISE</span>
            </button>
            {currentSeason && (
              <button
                onClick={() => handleManualSaveCurrent(slotId)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition"
              >
                Save Current Here
              </button>
            )}
          </div>
        </div>
      );
    }

    const team = getTeamById(slot.season.userTeamId);
    const standing = slot.season.standings[team.id] || { wins: 0, losses: 0, ties: 0 };
    const weekLabel = slot.season.currentWeek <= 18
      ? `Week ${slot.season.currentWeek}`
      : slot.season.currentWeek === 19
      ? 'Wild Card'
      : slot.season.currentWeek === 20
      ? 'Divisional'
      : slot.season.currentWeek === 21
      ? 'Conf Champ'
      : slot.season.currentWeek === 22
      ? 'Super Bowl'
      : slot.season.stage === 'Offseason_Draft'
      ? 'NFL Draft'
      : slot.season.stage === 'Offseason_FreeAgency'
      ? 'Free Agency'
      : 'Offseason';

    return (
      <div
        key={slotId}
        className={`relative rounded-2xl p-5 border transition flex flex-col justify-between ${
          isCurrentActive
            ? 'bg-slate-900/90 border-amber-500 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/50'
            : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90 shadow-lg'
        }`}
      >
        {isCurrentActive && (
          <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-display font-black text-[10px] tracking-wider uppercase flex items-center space-x-1 shadow-md">
            <Check className="w-3 h-3" />
            <span>ACTIVE LOADED</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-lg shadow-md flex-shrink-0"
              style={{
                backgroundColor: team.primaryColor,
                color: team.textColor || '#ffffff',
                border: `2px solid ${team.secondaryColor || '#ffffff'}`,
              }}
            >
              {team.abbr}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-amber-400 block uppercase">
                  SLOT #{slotId} • YEAR {slot.season.seasonYear || 2026}
                </span>
                {editingSlotId !== slotId && (
                  <button
                    onClick={(e) => handleStartRename(slotId, slot.saveName || `${team.city} ${team.name}`, e)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition cursor-pointer"
                    title="Rename this save slot"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {editingSlotId === slotId ? (
                <form onSubmit={(e) => handleSaveRename(slotId, e)} className="flex items-center space-x-1.5 my-1">
                  <input
                    type="text"
                    value={editingNameValue}
                    onChange={(e) => setEditingNameValue(e.target.value)}
                    autoFocus
                    className="flex-1 bg-slate-950 border border-amber-500 rounded px-2 py-1 text-xs text-white font-display font-bold focus:outline-none"
                    placeholder="Enter save name..."
                  />
                  <button
                    type="submit"
                    className="p-1 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-400"
                    title="Save name"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelRename}
                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <h4 className="font-display font-black text-lg text-white truncate" title={slot.saveName || `${team.city} ${team.name}`}>
                  {slot.saveName || `${team.city} ${team.name}`}
                </h4>
              )}

              <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                <span className="font-bold text-white">
                  {standing.wins}-{standing.losses}{standing.ties > 0 ? `-${standing.ties}` : ''}
                </span>
                <span>•</span>
                <span className="text-amber-300 font-mono">{weekLabel}</span>
                <span>•</span>
                <span className="text-slate-300">OVR {team.ovr}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info & Timestamp */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Saved {slot.savedAt}</span>
          </div>
          <span className="font-mono text-slate-400">{slot.season.userRoster?.length || 16} Players</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 mt-4 pt-2">
          <button
            onClick={() => handleSelectSlot(slot)}
            className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs shadow-md transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>LOAD SAVE</span>
          </button>

          {currentSeason && currentSeason.slotId === slotId && (
            <button
              onClick={() => handleManualSaveCurrent(slotId)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
              title="Save current season state into this slot"
            >
              Update Save
            </button>
          )}

          <button
            onClick={(e) => handleDeletePrompt(slotId, e)}
            id={`btn-delete-slot-${slotId}`}
            className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-slate-950 hover:bg-rose-950/80 text-rose-400 border border-slate-800 hover:border-rose-800 font-bold text-xs transition"
            title="Delete Save File"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl space-y-6 my-auto max-h-[90vh] overflow-y-auto pr-1">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-xl text-white tracking-wide">
                  FRANCHISE <span className="text-amber-500">SAVE FILES</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Manage your 3 independent franchise save slots with full roster persistence.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 3 Slots Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderSlotCard(1)}
            {renderSlotCard(2)}
            {renderSlotCard(3)}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-500">
            <span>Auto-saves every simulated play, week advancement, draft pick, and free agent deal.</span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL WITH YES / NO BUTTONS */}
      {deleteConfirmSlotId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-950 border-2 border-rose-600/60 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto shadow-lg shadow-rose-500/20">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="font-display font-black text-xl text-white uppercase tracking-wider">
                ARE YOU SURE?
              </h3>
              <p className="text-sm text-slate-300">
                Are you sure you want to delete <strong className="text-rose-400">Save File Slot #{deleteConfirmSlotId}</strong>? Once deleted, this save file will be permanently removed from your device.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                id="btn-confirm-delete-yes"
                onClick={handleConfirmPermanentDelete}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-black text-sm uppercase tracking-wider transition shadow-lg shadow-rose-600/30 border border-rose-400"
              >
                YES
              </button>

              <button
                type="button"
                id="btn-confirm-delete-no"
                onClick={() => setDeleteConfirmSlotId(null)}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-display font-bold text-sm uppercase tracking-wider transition border border-slate-700"
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
