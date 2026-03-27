'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DeviceForm, DeviceFormData, DEFAULT_FORM_DATA } from '@/components/devices/device-form';
import { useDevice, updateDevice, deleteDevice } from '@/hooks/use-devices';
import { useToast } from '@/components/ui/toast';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function EditDevicePage() {
    const router = useRouter();
    const params = useParams();
    const deviceId = params.id as string;
    const { device, loading, error } = useDevice(deviceId);
    const { addToast } = useToast();

    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(false);
    const [formData, setFormData] = useState<DeviceFormData>(DEFAULT_FORM_DATA);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Populate form from device
    useEffect(() => {
        if (device && !initialized) {
            setFormData({
                hostname: device.hostname || '',
                ipAddress: device.ipAddress || '',
                displayName: device.displayName || '',
                deviceType: device.deviceType || 'unknown',
                locationId: device.locationId ? String(device.locationId) : '',
                snmpVersion: device.snmpVersion || 'v2c',
                snmpCommunity: '',
                snmpPort: '161',
                pollingInterval: String(device.pollingInterval || 300),
                pollingEnabled: true,
                snmpV3User: '',
                snmpV3AuthProto: 'SHA',
                snmpV3AuthPass: '',
                snmpV3PrivProto: 'AES',
                snmpV3PrivPass: '',
            });
            setInitialized(true);
        }
    }, [device, initialized]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!formData.hostname.trim() || !formData.ipAddress.trim()) {
            setFormError('Hostname and IP Address are required.');
            return;
        }

        try {
            setSaving(true);
            const payload: Record<string, any> = {
                hostname: formData.hostname.trim(),
                ipAddress: formData.ipAddress.trim(),
                deviceType: formData.deviceType,
                locationId: formData.locationId ? parseInt(formData.locationId) : null,
                snmpVersion: formData.snmpVersion,
                snmpPort: parseInt(formData.snmpPort) || 161,
                pollingInterval: parseInt(formData.pollingInterval) || 300,
                pollingEnabled: formData.pollingEnabled,
            };

            if (formData.displayName.trim()) payload.displayName = formData.displayName.trim();

            if (formData.snmpCommunity && formData.snmpCommunity !== '••••••') {
                payload.snmpCommunity = formData.snmpCommunity;
            }

            if (formData.snmpVersion === 'v3') {
                if (formData.snmpV3User) payload.snmpV3User = formData.snmpV3User;
                if (formData.snmpV3AuthProto) payload.snmpV3AuthProto = formData.snmpV3AuthProto;
                if (formData.snmpV3AuthPass && formData.snmpV3AuthPass !== '••••••') payload.snmpV3AuthPass = formData.snmpV3AuthPass;
                if (formData.snmpV3PrivProto) payload.snmpV3PrivProto = formData.snmpV3PrivProto;
                if (formData.snmpV3PrivPass && formData.snmpV3PrivPass !== '••••••') payload.snmpV3PrivPass = formData.snmpV3PrivPass;
            }

            await updateDevice(parseInt(deviceId), payload);
            addToast({ type: 'success', title: 'Device Updated', message: `${formData.hostname} has been updated successfully.` });
            router.push(`/devices/${deviceId}`);
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Failed to update device';
            setFormError(msg);
            addToast({ type: 'error', title: 'Update Failed', message: msg });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!device) return;
        try {
            setDeleting(true);
            await deleteDevice(device.id);
            addToast({ type: 'success', title: 'Device Deleted', message: `"${device.hostname}" has been deleted.` });
            router.push('/devices');
        } catch (err: any) {
            addToast({ type: 'error', title: 'Delete Failed', message: err.response?.data?.message || 'Could not delete device.' });
        } finally {
            setDeleting(false);
        }
    };

    if (loading) return <DashboardSkeleton />;
    if (error || !device) return <ErrorState message={error || 'Device not found'} />;

    return (
        <>
            <DeviceForm
                mode="edit"
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                saving={saving}
                error={formError}
                breadcrumbs={[
                    { label: 'Devices', href: '/devices' },
                    { label: device.hostname, href: `/devices/${deviceId}` },
                    { label: 'Edit Settings' },
                ]}
                title={`Edit ${device.hostname}`}
                subtitle="Modify device configuration, SNMP authentication, and polling intervals."
                cancelHref={`/devices/${deviceId}`}
                submitLabel="Save Changes"
                submittingLabel="Saving..."
                lastUpdated={new Date(device.updatedAt).toLocaleString()}
                onDelete={() => setShowDeleteConfirm(true)}
            />

            <ConfirmDialog
                open={showDeleteConfirm}
                title="Delete Device"
                message={`Are you sure you want to delete "${device.hostname}"? This action cannot be undone and will permanently remove all associated metrics and history.`}
                confirmLabel="Delete Device"
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </>
    );
}
