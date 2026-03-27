'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeviceForm, DeviceFormData, DEFAULT_FORM_DATA } from '@/components/devices/device-form';
import { createDevice } from '@/hooks/use-devices';

export default function NewDevicePage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<DeviceFormData>(DEFAULT_FORM_DATA);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.hostname.trim() || !formData.ipAddress.trim()) {
            setError('Hostname and IP Address are required.');
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
                snmpCommunity: formData.snmpCommunity.trim() || 'public',
                snmpPort: parseInt(formData.snmpPort) || 161,
                pollingInterval: parseInt(formData.pollingInterval) || 300,
                pollingEnabled: formData.pollingEnabled,
            };

            if (formData.displayName.trim()) payload.displayName = formData.displayName.trim();

            if (formData.snmpVersion === 'v3') {
                if (formData.snmpV3User) payload.snmpV3User = formData.snmpV3User;
                if (formData.snmpV3AuthProto) payload.snmpV3AuthProto = formData.snmpV3AuthProto;
                if (formData.snmpV3AuthPass) payload.snmpV3AuthPass = formData.snmpV3AuthPass;
                if (formData.snmpV3PrivProto) payload.snmpV3PrivProto = formData.snmpV3PrivProto;
                if (formData.snmpV3PrivPass) payload.snmpV3PrivPass = formData.snmpV3PrivPass;
            }

            const device = await createDevice(payload);
            router.push(`/devices/${device.id}`);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Failed to create device');
        } finally {
            setSaving(false);
        }
    };

    return (
        <DeviceForm
            mode="create"
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            saving={saving}
            error={error}
            breadcrumbs={[
                { label: 'Devices', href: '/devices' },
                { label: 'Add New Device' },
            ]}
            title="Add New Device"
            subtitle="Configure SNMP monitoring for a network device."
            cancelHref="/devices"
            submitLabel="Create Device"
            submittingLabel="Creating..."
        />
    );
}
