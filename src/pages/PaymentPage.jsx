import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Calendar as CalendarIcon,
    Save,
    Plus,
    Trash2,
    Banknote,
    Coins,
    ArrowRightLeft,
    Search,
    CreditCard,
    MoreHorizontal,
    Users,
    Split,
    CalendarClock
} from 'lucide-react';

import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { appointmentService } from '../services/appointmentService';
import { patientService } from '../services/patientService';
import { visitService } from '../services/visitService';
import ReservationModal from '../components/ReservationModal';

// Portal Component for Autocomplete
const AutocompletePortal = ({ rect, list, onSelect, portalRef }) => {
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={portalRef}
            className="fixed bg-white border border-gray-300 shadow-xl rounded-md overflow-hidden z-[9999]"
            style={{
                top: rect.bottom + 5,
                left: rect.left,
                width: Math.max(rect.width, 200), // Min width
                maxHeight: '200px',
                overflowY: 'auto'
            }}
        >
            {list.length > 0 ? (
                list.map(patient => (
                    <div
                        key={patient.id}
                        onClick={() => onSelect(patient)}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-left text-sm text-gray-800 border-b border-gray-50 last:border-none"
                    >
                        <span className="font-bold">{patient.name}</span>
                        <span className="text-xs text-gray-500 ml-2">
                            {patient.phone || patient.residentNumber?.substring(0, 6) || ''}
                        </span>
                    </div>
                ))
            ) : (
                <div className="px-4 py-2 text-gray-400 text-sm">검색 결과 없음</div>
            )}
        </div>,
        document.body
    );
};

const PaymentPage = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Data States
    const [incomes, setIncomes] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [closingData, setClosingData] = useState({
        prevBalance: 200000,
        directorDeposit: 0
    });

    // Autocomplete States
    const [allPatients, setAllPatients] = useState([]);
    const [suggestions, setSuggestions] = useState({ visible: false, list: [], rowIndex: -1, rect: null });
    const suggestionRef = useRef(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, rowId: null, field: null });
    const contextMenuRef = useRef(null);

    // Split Payment Modal State
    const [splitModal, setSplitModal] = useState({ visible: false, rowId: null, field: null, totalAmount: 0 });
    const [splitPrepaidAmount, setSplitPrepaidAmount] = useState('');

    // Reservation Modal State
    const [reservationModalOpen, setReservationModalOpen] = useState(false);

    // Load patients for autocomplete on mount
    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const patients = await patientService.getPatients();
                console.log("Loaded patients for autocomplete:", patients);
                console.log("📋 자동완성용 환자 목록 로드됨:", patients ? patients.length : 0, "명");
                if (!patients || patients.length === 0) {
                    console.warn("No patients found in DB, using fallback.");
                    setAllPatients([
                        { id: 'test1', name: '김철수', phone: '010-1111-2222' },
                        { id: 'test2', name: '이영희', phone: '010-3333-4444' },
                        { id: 'test3', name: '박지민', phone: '010-5555-6666' }
                    ]);
                } else {
                    setAllPatients(patients);
                }
            } catch (error) {
                console.error("Failed to load patients:", error);
                // Fallback for testing if DB fails
                setAllPatients([
                    { id: 'test1', name: '김철수', phone: '010-1111-2222' },
                    { id: 'test2', name: '이영희', phone: '010-3333-4444' },
                    { id: 'test3', name: '박지민', phone: '010-5555-6666' }
                ]);
            }
        };
        fetchPatients();
    }, []);

    const loadData = useCallback(async (date) => {
        setLoading(true);
        try {
            console.log("Loading data for", date);

            // 1. Load Saved Payment Data
            const docRef = doc(db, "daily_payments", date);
            const docSnap = await getDoc(docRef);

            const defaultData = {
                date,
                incomes: Array(30).fill().map((_, i) => ({
                    id: i + 1,
                    name: '',
                    cash: 0, card: 0, support: 0, transfer: 0, zero: 0, unpaid: 0, memo: '',
                    prepaidFields: []
                })),
                expenses: [{ id: 1, item: '', amount: 0 }],
                closingData: { prevBalance: 200000, directorDeposit: 0 }
            };

            let savedIncomes = defaultData.incomes;
            let savedExpenses = defaultData.expenses;
            let savedClosingData = defaultData.closingData;

            if (docSnap.exists()) {
                const data = docSnap.data();
                savedIncomes = (data.incomes || defaultData.incomes).map((item, idx) => ({
                    ...defaultData.incomes[idx],
                    ...item,
                    prepaidFields: item.prepaidFields || []
                }));
                savedExpenses = data.expenses || defaultData.expenses;
                if (savedExpenses.length === 0) {
                    savedExpenses = [{ id: 1, item: '', amount: 0 }];
                }
                savedClosingData = data.closingData || defaultData.closingData;
            }

            // 2. Load Appointments & Visits (Auto-merge)
            const appointments = await appointmentService.getAppointments();
            const visits = await visitService.getVisitsByDate(date);

            const todaysAppointments = appointments.filter(app => {
                let appDate = '';
                if (app.date) appDate = app.date;
                else if (app.start) appDate = app.start.split('T')[0];
                return appDate === date;
            });

            // 3. Merge Logic
            const incomeMap = new Map();
            savedIncomes.forEach(item => {
                if (item.name && item.name.trim()) {
                    incomeMap.set(item.name, item);
                }
            });

            const findEmptySlot = (incomes) => {
                return incomes.findIndex(item => !item.name || !item.name.trim());
            };

            const patientNames = new Set([
                ...todaysAppointments.map(app => app.patientName || (app.title ? app.title.split(' - ')[0] : '')),
                ...visits.map(v => {
                    const p = allPatients.find(p => p.id === v.patientId);
                    return p ? p.name : '';
                })
            ]);

            patientNames.forEach(name => {
                if (!name) return;

                if (incomeMap.has(name)) {
                    const existingItem = incomeMap.get(name);
                    const visit = visits.find(v => {
                        const p = allPatients.find(p => p.id === v.patientId);
                        return p && p.name === name;
                    });

                    if (visit) {
                        existingItem.unpaid = visit.totalCost || 0;
                    }
                } else {
                    const emptyIdx = findEmptySlot(savedIncomes);
                    const visit = visits.find(v => {
                        const p = allPatients.find(p => p.id === v.patientId);
                        return p && p.name === name;
                    });

                    const newItem = {
                        name: name,
                        cash: 0, card: 0, support: 0, transfer: 0, zero: 0,
                        unpaid: visit ? (visit.totalCost || 0) : 0,
                        memo: '',
                        prepaidFields: []
                    };

                    if (emptyIdx !== -1) {
                        savedIncomes[emptyIdx] = { ...savedIncomes[emptyIdx], ...newItem };
                    } else {
                        savedIncomes.push({
                            id: Date.now() + Math.random(),
                            ...newItem
                        });
                    }
                }
            });

            setIncomes(savedIncomes);
            setExpenses(savedExpenses);
            setClosingData(savedClosingData);

        } catch (error) {
            console.error("Failed to load data:", error);
            alert('데이터 불러오기 실패: ' + error.message);
        } finally {
            setLoading(false);
        }
    }, [allPatients]);

    // Load data on date change
    useEffect(() => {
        loadData(selectedDate);
    }, [loadData, selectedDate]);

    // Close suggestions and context menu on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
                setSuggestions({ visible: false, list: [], rowIndex: -1, rect: null });
            }
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
                setContextMenu({ ...contextMenu, visible: false });
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [contextMenu]);

    const handleKeyDown = (e, rowIndex, field) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            if (field === 'name' && suggestions.visible && e.key === 'Enter') return;

            e.preventDefault();

            const fields = ['name', 'cash', 'card', 'support', 'transfer', 'zero', 'unpaid', 'memo'];
            let nextRow = rowIndex;
            let nextFieldIdx = fields.indexOf(field);

            if (e.key === 'Enter') {
                if (nextFieldIdx < fields.length - 1) {
                    nextFieldIdx++;
                } else {
                    nextFieldIdx = 0;
                    nextRow++;
                }
            } else if (e.key === 'ArrowRight') {
                if (nextFieldIdx < fields.length - 1) nextFieldIdx++;
            } else if (e.key === 'ArrowLeft') {
                if (nextFieldIdx > 0) nextFieldIdx--;
            } else if (e.key === 'ArrowDown') {
                nextRow++;
            } else if (e.key === 'ArrowUp') {
                nextRow--;
            }

            if (nextRow >= 0 && nextRow < incomes.length) {
                const nextField = fields[nextFieldIdx];
                const nextInputId = `income-${nextRow}-${nextField}`;
                const nextElement = document.getElementById(nextInputId);
                if (nextElement) {
                    nextElement.focus();
                    if (nextElement.select) nextElement.select();
                }
            }
        }
    };

    // --- Context Menu Handlers ---
    const handleContextMenu = (e, rowId, field) => {
        e.preventDefault();
        const numericFields = ['cash', 'card', 'support', 'transfer', 'zero', 'unpaid'];
        if (!numericFields.includes(field)) return;

        setContextMenu({
            visible: true,
            x: e.pageX,
            y: e.pageY,
            rowId,
            field
        });
    };

    const handlePrepaidClick = () => {
        const item = incomes.find(i => i.id === contextMenu.rowId);
        if (!item) return;

        const currentFields = item.prepaidFields || [];
        const isPrepaid = currentFields.includes(contextMenu.field);

        if (isPrepaid) {
            // Unmark
            setIncomes(prev => prev.map(i => {
                if (i.id === contextMenu.rowId) {
                    return { ...i, prepaidFields: i.prepaidFields.filter(f => f !== contextMenu.field) };
                }
                return i;
            }));
            setContextMenu({ ...contextMenu, visible: false });
        } else {
            // Mark
            const amount = item[contextMenu.field] || 0;
            if (amount > 0) {
                setSplitModal({
                    visible: true,
                    rowId: contextMenu.rowId,
                    field: contextMenu.field,
                    totalAmount: amount
                });
                setSplitPrepaidAmount(amount.toString());
            } else {
                setIncomes(prev => prev.map(i => {
                    if (i.id === contextMenu.rowId) {
                        return { ...i, prepaidFields: [...(i.prepaidFields || []), contextMenu.field] };
                    }
                    return i;
                }));
            }
            setContextMenu({ ...contextMenu, visible: false });
        }
    };

    const confirmSplit = () => {
        const prepaidAmt = Number(splitPrepaidAmount);
        const totalAmt = splitModal.totalAmount;
        const normalAmt = totalAmt - prepaidAmt;

        if (prepaidAmt < 0 || prepaidAmt > totalAmt) {
            alert('올바른 금액을 입력해주세요.');
            return;
        }

        setIncomes(prev => {
            const newIncomes = [...prev];
            const currentRowIdx = newIncomes.findIndex(i => i.id === splitModal.rowId);
            if (currentRowIdx === -1) return prev;

            // 1. Update current row (Prepaid)
            newIncomes[currentRowIdx] = {
                ...newIncomes[currentRowIdx],
                [splitModal.field]: prepaidAmt,
                prepaidFields: [...(newIncomes[currentRowIdx].prepaidFields || []), splitModal.field]
            };

            // 2. Insert new row immediately below for Normal Amount
            if (normalAmt > 0) {
                const newRow = {
                    id: Date.now(), // Unique ID
                    name: newIncomes[currentRowIdx].name, // Copy name
                    cash: 0, card: 0, support: 0, transfer: 0, zero: 0, unpaid: 0, memo: '',
                    prepaidFields: [],
                    [splitModal.field]: normalAmt // Set the normal amount
                };

                // Insert at next index
                newIncomes.splice(currentRowIdx + 1, 0, newRow);

                // Optional: Maintain fixed size or allow growth? 
                // User didn't specify, but usually we want to keep the grid clean. 
                // If we want to keep 30 rows, we might pop the last one if it's empty.
                // For now, let's just allow it to grow to avoid data loss.
            }

            return newIncomes;
        });

        setSplitModal({ visible: false, rowId: null, field: null, totalAmount: 0 });
        setSplitPrepaidAmount('');
    };

    // --- Income Handlers ---
    // --- Income Handlers ---
    const handleIncomeChange = (id, field, value, e) => {
        setIncomes(prev => prev.map(item => {
            if (item.id === id) {
                const numFields = ['cash', 'card', 'support', 'transfer', 'zero', 'unpaid'];
                const newValue = numFields.includes(field) ? (Number(value) || 0) : value;
                return { ...item, [field]: newValue };
            }
            return item;
        }));

        if (field === 'name') {
            console.log("🔍 검색어:", value);
            const domRect = e?.target?.getBoundingClientRect();
            const rect = domRect ? {
                bottom: domRect.bottom,
                left: domRect.left,
                width: domRect.width
            } : null;

            if (value.trim()) {
                const filtered = allPatients.filter(p => p.name && p.name.includes(value)).slice(0, 10);
                console.log("✅ 필터링된 결과 수:", filtered.length);
                setSuggestions({
                    visible: filtered.length > 0,
                    list: filtered,
                    rowIndex: incomes.findIndex(item => item.id === id),
                    rect
                });
            } else {
                setSuggestions({ visible: false, list: [], rowIndex: -1, rect: null });
            }
        }
    };

    const selectPatient = (patient) => {
        if (suggestions.rowIndex !== -1) {
            setIncomes(prev => prev.map((item, index) => {
                if (index === suggestions.rowIndex) {
                    return { ...item, name: patient.name };
                }
                return item;
            }));
            setSuggestions({ visible: false, list: [], rowIndex: -1, rect: null });

            setTimeout(() => {
                const nextInputId = `income-${suggestions.rowIndex}-cash`;
                const nextElement = document.getElementById(nextInputId);
                if (nextElement) nextElement.focus();
            }, 0);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const dataToSave = {
                date: selectedDate,
                incomes: incomes.map(item => ({
                    ...item,
                    cash: Number(item.cash) || 0,
                    card: Number(item.card) || 0,
                    support: Number(item.support) || 0,
                    transfer: Number(item.transfer) || 0,
                    zero: Number(item.zero) || 0,
                    unpaid: Number(item.unpaid) || 0,
                })),
                expenses: expenses.map(item => ({
                    ...item,
                    amount: Number(item.amount) || 0
                })),
                closingData,
                updatedAt: serverTimestamp()
            };

            await setDoc(doc(db, "daily_payments", selectedDate), dataToSave);
            alert('저장되었습니다.');
        } catch (error) {
            console.error("Error saving data:", error);
            alert('저장 중 오류가 발생했습니다: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // --- Expense Handlers ---
    const addExpense = () => {
        const newId = expenses.length > 0 ? Math.max(...expenses.map(e => e.id)) + 1 : 1;
        setExpenses([...expenses, { id: newId, item: '', amount: 0 }]);
    };

    const removeExpense = (id) => {
        setExpenses(expenses.filter(e => e.id !== id));
    };

    const handleExpenseChange = (id, field, value) => {
        setExpenses(prev => {
            const newExpenses = prev.map(item => {
                if (item.id === id) {
                    const newValue = field === 'amount' ? (Number(value) || 0) : value;
                    return { ...item, [field]: newValue };
                }
                return item;
            });

            // Auto-add new row if the last row is being edited and has content
            const lastItem = newExpenses[newExpenses.length - 1];
            if (lastItem && (lastItem.item.trim() !== '' || lastItem.amount > 0)) {
                const newId = newExpenses.length > 0 ? Math.max(...newExpenses.map(e => e.id)) + 1 : 1;
                return [...newExpenses, { id: newId, item: '', amount: 0 }];
            }

            return newExpenses;
        });
    };

    // --- Calculations ---
    const totals = useMemo(() => {
        if (!Array.isArray(incomes) || !Array.isArray(expenses)) {
            console.warn("Incomes or Expenses is not an array", { incomes, expenses });
            return {
                cash: 0, card: 0, support: 0, transfer: 0, zero: 0, unpaid: 0,
                totalActualIncome: 0, cardRecovery: 0, cashRecovery: 0,
                totalExpense: 0, currentBalance: 0, directorDeposit: 0
            };
        }

        const incomeTotals = incomes.reduce((acc, curr) => {
            return {
                cash: acc.cash + (Number(curr.cash) || 0),
                card: acc.card + (Number(curr.card) || 0),
                support: acc.support + (Number(curr.support) || 0),
                transfer: acc.transfer + (Number(curr.transfer) || 0),
                zero: acc.zero + (Number(curr.zero) || 0),
                unpaid: acc.unpaid + (Number(curr.unpaid) || 0)
            };
        }, { cash: 0, card: 0, support: 0, transfer: 0, zero: 0, unpaid: 0 });

        const totalActualIncome =
            incomeTotals.cash +
            incomeTotals.card +
            incomeTotals.support +
            incomeTotals.transfer +
            incomeTotals.zero;

        const cardRecovery = incomeTotals.card + incomeTotals.zero;
        const cashRecovery = incomeTotals.cash + incomeTotals.transfer;

        const totalExpense = expenses.reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0);

        const currentBalance = (closingData?.prevBalance || 0) + incomeTotals.cash - totalExpense;
        const directorDeposit = currentBalance - (closingData?.prevBalance || 0);

        return {
            ...incomeTotals,
            totalActualIncome,
            cardRecovery,
            cashRecovery,
            totalExpense,
            currentBalance,
            directorDeposit
        };
    }, [incomes, expenses, closingData]);

    const fmt = (num) => num.toLocaleString();

    return (
        <div className="h-screen bg-gray-100 flex flex-col overflow-hidden font-sans" onContextMenu={(e) => e.preventDefault()}>
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center space-x-4">
                    <div className="bg-blue-600 p-2 rounded-lg text-white">
                        <Banknote className="w-5 h-5" />
                    </div>
                    <h1 className="text-lg font-bold text-gray-800">수납 일지</h1>
                    <div className="flex items-center bg-gray-100 rounded-md px-2 py-1">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 p-0"
                        />
                    </div>
                </div>
                <div className="flex items-center space-x-2">

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 text-sm font-medium"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? '저장 중...' : '저장하기'}
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col p-4 space-y-4">

                {/* Income Table Section */}
                <div className="flex-1 bg-white rounded-lg shadow border border-gray-200 flex flex-col overflow-hidden relative">
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-sm border-collapse">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th rowSpan="2" className="border border-gray-300 px-2 py-1 w-10 text-center bg-gray-100">번호</th>
                                    <th rowSpan="2" className="border border-gray-300 px-2 py-1 w-32 text-center bg-gray-100">이름</th>
                                    <th colSpan="3" className="border border-gray-300 px-2 py-1 text-center bg-gray-200">수납 구분</th>
                                    <th rowSpan="2" className="border border-gray-300 px-2 py-1 w-24 text-center bg-gray-100">계좌이체</th>
                                    <th rowSpan="2" className="border border-gray-300 px-2 py-1 w-24 text-center bg-gray-100">제로/이노</th>
                                    <th rowSpan="2" className="border border-gray-300 px-2 py-1 w-24 text-center bg-gray-100">미수금</th>
                                    <th rowSpan="2" className="border border-gray-300 px-2 py-1 text-center bg-gray-100">비고</th>
                                </tr>
                                <tr>
                                    <th className="border border-gray-300 px-2 py-1 w-24 text-center bg-yellow-100">현금</th>
                                    <th className="border border-gray-300 px-2 py-1 w-24 text-center bg-blue-100">카드</th>
                                    <th className="border border-gray-300 px-2 py-1 w-24 text-center bg-gray-100">건생/지원</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incomes.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="border border-gray-300 px-2 py-1 text-center text-gray-500">{index + 1}</td>
                                        <td className="border border-gray-300 px-2 py-1 relative">
                                            <input
                                                id={`income-${index}-name`}
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => handleIncomeChange(item.id, 'name', e.target.value, e)}
                                                onKeyDown={(e) => handleKeyDown(e, index, 'name')}
                                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-900 text-center"
                                                autoComplete="off"
                                            />
                                        </td>
                                        {['cash', 'card', 'support', 'transfer', 'zero', 'unpaid'].map(field => (
                                            <td
                                                key={field}
                                                className={`border border-gray-300 px-2 py-1 
                                                    ${field === 'cash' ? 'bg-yellow-50' : ''} 
                                                    ${field === 'card' ? 'bg-blue-50' : ''}
                                                    ${(item.prepaidFields || []).includes(field) ? '!bg-purple-200' : ''}
                                                `}
                                                onContextMenu={(e) => handleContextMenu(e, item.id, field)}
                                            >
                                                <input
                                                    id={`income-${index}-${field}`}
                                                    type="number"
                                                    value={item[field] || ''}
                                                    onChange={(e) => handleIncomeChange(item.id, field, e.target.value)}
                                                    onKeyDown={(e) => handleKeyDown(e, index, field)}
                                                    className={`w-full bg-transparent border-none focus:ring-0 p-0 text-right ${field === 'unpaid' ? 'text-red-600' : ''}`}
                                                />
                                            </td>
                                        ))}
                                        <td className="border border-gray-300 px-2 py-1">
                                            <input
                                                id={`income-${index}-memo`}
                                                type="text"
                                                value={item.memo}
                                                onChange={(e) => handleIncomeChange(item.id, 'memo', e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, index, 'memo')}
                                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-600"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 font-bold sticky bottom-0 z-10">
                                <tr>
                                    <td colSpan={2} className="border border-gray-300 px-2 py-2 text-center">구분 합계</td>
                                    <td className="border border-gray-300 px-2 py-2 text-right bg-yellow-100">{fmt(totals.cash)}</td>
                                    <td className="border border-gray-300 px-2 py-2 text-right bg-blue-100">{fmt(totals.card)}</td>
                                    <td className="border border-gray-300 px-2 py-2 text-right">{fmt(totals.support)}</td>
                                    <td className="border border-gray-300 px-2 py-2 text-right">{fmt(totals.transfer)}</td>
                                    <td className="border border-gray-300 px-2 py-2 text-right">{fmt(totals.zero)}</td>
                                    <td className="border border-gray-300 px-2 py-2 text-right text-red-600">{fmt(totals.unpaid)}</td>
                                    <td className="border border-gray-300"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="h-[250px] flex space-x-4">
                    {/* Left: Expense Table Section */}
                    <div className="flex-1 bg-white rounded-lg shadow border border-gray-200 flex flex-col">
                        <div className="px-4 py-2 border-b border-gray-200 font-bold text-gray-700 bg-gray-50">
                            지출 목록
                        </div>
                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-700 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left w-12 text-center">No</th>
                                        <th className="px-4 py-2 text-left">지출 내역</th>
                                        <th className="px-4 py-2 text-right w-24">금액</th>
                                        <th className="px-4 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.map((expense, index) => (
                                        <tr key={expense.id} className="border-b border-gray-100 last:border-none hover:bg-gray-50">
                                            <td className="px-4 py-2 text-center text-gray-500">{index + 1}</td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={expense.item}
                                                    onChange={(e) => handleExpenseChange(expense.id, 'item', e.target.value)}
                                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-800"
                                                    placeholder="내역 입력"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="number"
                                                    value={expense.amount}
                                                    onChange={(e) => handleExpenseChange(expense.id, 'amount', e.target.value)}
                                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-right text-red-600 font-medium"
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    onClick={() => removeExpense(expense.id)}
                                                    className="text-gray-400 hover:text-red-500"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Summary Section */}
                    <div className="flex-1 bg-white rounded-lg shadow border border-gray-200 flex flex-col">
                        <div className="flex-1 p-0 overflow-auto">
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr className="bg-red-50/50 border-b border-gray-200">
                                        <th className="px-4 py-2 text-left text-gray-600 font-medium">총 실수납액</th>
                                        <td className="px-4 py-2 text-right font-bold text-lg text-gray-800">{fmt(totals.totalActualIncome)}</td>
                                    </tr>
                                    <tr className="border-b border-gray-200">
                                        <th className="px-4 py-2 text-left text-gray-500 font-normal">(결산) 카드수납+회수</th>
                                        <td className="px-4 py-2 text-right font-medium">{fmt(totals.cardRecovery)}</td>
                                    </tr>
                                    <tr className="border-b border-gray-200">
                                        <th className="px-4 py-2 text-left text-gray-500 font-normal">(결산) 현금수납+회수</th>
                                        <td className="px-4 py-2 text-right font-medium">{fmt(totals.cashRecovery)}</td>
                                    </tr>

                                    {/* Spacer */}
                                    <tr><td colSpan={2} className="h-4 bg-gray-50"></td></tr>

                                    <tr className="border-b border-gray-200">
                                        <th className="px-4 py-2 text-left text-gray-500">전 잔액</th>
                                        <td className="px-4 py-2 text-right font-medium">{fmt(closingData.prevBalance)}</td>
                                    </tr>
                                    <tr className="border-b border-gray-200 bg-blue-50/30">
                                        <th className="px-4 py-2 text-left text-gray-800 font-bold">현 잔액</th>
                                        <td className="px-4 py-2 text-right font-bold text-blue-700">{fmt(totals.currentBalance)}</td>
                                    </tr>
                                    <tr className="bg-purple-50">
                                        <th className="px-4 py-2 text-left text-purple-800 font-bold">원장 입금</th>
                                        <td className="px-4 py-2 text-right font-bold text-purple-700">{fmt(totals.directorDeposit)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Reservation Modal */}
                <ReservationModal
                    isOpen={reservationModalOpen}
                    onClose={() => setReservationModalOpen(false)}
                    selectedDate={selectedDate}
                />
            </div>

            {/* Context Menu */}
            {
                contextMenu.visible && (
                    <div
                        ref={contextMenuRef}
                        className="absolute bg-white border border-gray-200 shadow-lg rounded-md py-1 z-50 w-48"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <button
                            onClick={handlePrepaidClick}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center"
                        >
                            <CreditCard className="w-4 h-4 mr-2 text-purple-600" />
                            {incomes.find(i => i.id === contextMenu.rowId)?.prepaidFields?.includes(contextMenu.field) ? '선수납/패키지 해제' : '선수납/패키지 처리'}
                        </button>
                    </div>
                )
            }

            {/* Split Payment Modal */}
            {
                splitModal.visible && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl p-6 w-80">
                            <h3 className="text-lg font-bold mb-4 flex items-center">
                                <Split className="w-5 h-5 mr-2 text-purple-600" />
                                선수납/패키지 분할
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">총 금액</label>
                                    <div className="text-lg font-bold text-gray-900">{fmt(splitModal.totalAmount)}원</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">선수납 적용 금액</label>
                                    <input
                                        type="number"
                                        value={splitPrepaidAmount}
                                        onChange={(e) => setSplitPrepaidAmount(e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                        autoFocus
                                    />
                                </div>
                                <div className="pt-2 border-t border-gray-100">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">일반 결제 (자동 분리)</span>
                                        <span className="font-bold">
                                            {fmt(splitModal.totalAmount - (Number(splitPrepaidAmount) || 0))}원
                                        </span>
                                    </div>
                                </div>
                                <div className="flex space-x-2 pt-2">
                                    <button
                                        onClick={() => setSplitModal({ visible: false, rowId: null, field: null, totalAmount: 0 })}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={confirmSplit}
                                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                                    >
                                        확인
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Autocomplete Dropdown - Using Portal for absolute positioning */}
            {
                suggestions.visible && suggestions.rect && (
                    <AutocompletePortal
                        rect={suggestions.rect}
                        list={suggestions.list}
                        onSelect={selectPatient}
                        portalRef={suggestionRef}
                    />
                )
            }
        </div >
    );
};

// Portal Component for Autocomplete

export default PaymentPage;
