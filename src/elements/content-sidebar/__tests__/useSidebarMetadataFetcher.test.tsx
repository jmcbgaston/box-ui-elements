import { MetadataTemplateFieldType } from '@box/metadata-editor/types/lib/types';
import { renderHook, waitFor } from '../../../test-utils/testing-library';
import messages from '../../common/messages';
import {
    ERROR_CODE_EMPTY_METADATA_SUGGESTIONS,
    ERROR_CODE_FETCH_METADATA_SUGGESTIONS,
    FIELD_PERMISSIONS_CAN_UPLOAD,
    SUCCESS_CODE_DELETE_METADATA_TEMPLATE_INSTANCE,
    SUCCESS_CODE_UPDATE_METADATA_TEMPLATE_INSTANCE,
} from '../../../constants';
import useSidebarMetadataFetcher, { STATUS } from '../hooks/useSidebarMetadataFetcher';

const mockError = {
    status: 500,
    message: 'Internal Server Error',
};

const mockFile = {
    id: '123',
    permissions: { [FIELD_PERMISSIONS_CAN_UPLOAD]: true },
};

const mockTemplates = [
    {
        canEdit: true,
        id: 'metadata_template_instance_1',
        fields: [
            {
                key: 'field1',
                type: 'string' as MetadataTemplateFieldType,
                hidden: false,
            },
            {
                key: 'field2',
                type: 'string' as MetadataTemplateFieldType,
                hidden: false,
            },
        ],
        scope: 'global',
        templateKey: 'templateKey',
    },
    {
        id: 'metadata_template_custom_1',
        scope: 'global',
        templateKey: 'properties',
        hidden: false,
    },
];

const mockTemplateInstances = [
    {
        canEdit: true,
        id: 'metadata_template_instance_2',
        fields: [],
        scope: 'global',
        templateKey: 'properties1',
        type: 'properties',
        hidden: false,
    },
];

const newTemplateInstance = {
    canEdit: true,
    id: 'metadata_template_instance_3',
    fields: [],
    scope: 'global',
    templateKey: 'properties',
    type: 'properties',
    hidden: false,
};

const mockAPI = {
    getFile: jest.fn((id, successCallback, errorCallback) => {
        try {
            successCallback(mockFile);
        } catch (error) {
            errorCallback(error);
        }
    }),
    getMetadata: jest.fn((_file, successCallback, errorCallback) => {
        try {
            successCallback({
                editors: [],
                templates: mockTemplates,
                templateInstances: mockTemplateInstances,
            });
        } catch (error) {
            errorCallback(error);
        }
    }),
    deleteMetadata: jest.fn((_file, template, successCallback, errorCallback) => {
        try {
            successCallback(template);
        } catch (error) {
            errorCallback(error);
        }
    }),
    createMetadataRedesign: jest.fn((_file, template, successCallback, errorCallback) => {
        try {
            successCallback();
        } catch (error) {
            errorCallback(error);
        }
    }),
    updateMetadataRedesign: jest.fn((_file, _metadataInstance, _JSONPatch, successCallback, errorCallback) => {
        try {
            successCallback();
        } catch (error) {
            errorCallback(error);
        }
    }),
    extractStructured: jest.fn(),
};
const api = {
    getFileAPI: jest.fn().mockReturnValue(mockAPI),
    getMetadataAPI: jest.fn().mockReturnValue(mockAPI),
    getIntelligenceAPI: jest.fn().mockReturnValue(mockAPI),
};

describe('useSidebarMetadataFetcher', () => {
    const onErrorMock = jest.fn();
    const onSuccessMock = jest.fn();
    const isFeatureEnabledMock = true;

    const setupHook = (fileId = '123') =>
        renderHook(() => useSidebarMetadataFetcher(api, fileId, onErrorMock, onSuccessMock, isFeatureEnabledMock));

    beforeEach(() => {
        onErrorMock.mockClear();
        onSuccessMock.mockClear();
        mockAPI.getFile.mockClear();
        mockAPI.getMetadata.mockClear();
        mockAPI.deleteMetadata.mockClear();
        mockAPI.updateMetadataRedesign.mockClear();
        mockAPI.extractStructured.mockClear();
    });

    test('should fetch the file and metadata successfully', async () => {
        const { result } = setupHook();

        await waitFor(() => expect(result.current.status).toBe(STATUS.SUCCESS));

        expect(result.current.file).toEqual(mockFile);
        expect(result.current.templates).toEqual(mockTemplates);
        expect(result.current.errorMessage).toBeNull();
    });

    test('should handle file fetching error', async () => {
        mockAPI.getFile.mockImplementation((id, successCallback, errorCallback) =>
            errorCallback(mockError, 'file_fetch_error'),
        );

        const { result } = setupHook();

        await waitFor(() => expect(result.current.status).toBe(STATUS.ERROR));

        expect(result.current.file).toBeUndefined();
        expect(result.current.errorMessage).toBe(messages.sidebarMetadataEditingErrorContent);
        expect(onSuccessMock).not.toHaveBeenCalled();
        expect(onErrorMock).toHaveBeenCalledWith(
            mockError,
            'file_fetch_error',
            expect.objectContaining({
                error: mockError,
                isErrorDisplayed: true,
            }),
        );
    });

    test('should handle metadata fetching error', async () => {
        mockAPI.getFile.mockImplementation((id, successCallback) => {
            successCallback(mockFile);
        });
        mockAPI.getMetadata.mockImplementation((file, successCallback, errorCallback) => {
            errorCallback(mockError, 'metadata_fetch_error');
        });
        const { result } = setupHook();

        await waitFor(() => expect(result.current.status).toBe(STATUS.ERROR));

        expect(result.current.templates).toBeNull();
        expect(result.current.errorMessage).toBe(messages.sidebarMetadataFetchingErrorContent);
        expect(onSuccessMock).not.toHaveBeenCalled();
        expect(onErrorMock).toHaveBeenCalledWith(
            mockError,
            'metadata_fetch_error',
            expect.objectContaining({
                error: mockError,
                isErrorDisplayed: true,
            }),
        );
    });

    test('should handle metadata instance removal', async () => {
        mockAPI.getMetadata.mockImplementation((file, successCallback) => {
            successCallback({ templateInstances: mockTemplateInstances, templates: mockTemplates });
        });
        mockAPI.deleteMetadata.mockImplementation((file, template, successCallback) => {
            successCallback(mockTemplateInstances[0]);
        });

        const { result } = setupHook();
        expect(result.current.templateInstances).toEqual(mockTemplateInstances);

        await waitFor(() => result.current.handleDeleteMetadataInstance(mockTemplateInstances[0]));

        expect(result.current.templates).toEqual(mockTemplates);
        expect(result.current.status).toEqual(STATUS.SUCCESS);
        expect(result.current.errorMessage).toBeNull();
        expect(onSuccessMock).toHaveBeenCalledWith(SUCCESS_CODE_DELETE_METADATA_TEMPLATE_INSTANCE, true);
    });

    test('should handle metadata instance removal error', async () => {
        mockAPI.getMetadata.mockImplementation((file, successCallback) => {
            successCallback({ templateInstances: mockTemplateInstances, templates: mockTemplates });
        });
        mockAPI.deleteMetadata.mockImplementation((file, template, successCallback, errorCallback) => {
            errorCallback(mockError, 'metadata_remove_error');
        });

        const { result } = setupHook();
        expect(result.current.status).toEqual(STATUS.SUCCESS);

        await waitFor(() => result.current.handleDeleteMetadataInstance(mockTemplateInstances[0]));

        expect(result.current.status).toEqual(STATUS.ERROR);
        expect(onSuccessMock).not.toHaveBeenCalled();
        expect(onErrorMock).toHaveBeenCalledWith(
            mockError,
            'metadata_remove_error',
            expect.objectContaining({
                error: mockError,
                isErrorDisplayed: true,
            }),
        );
    });

    test('should handle metadata instance creation', async () => {
        mockAPI.getMetadata.mockImplementation((file, successCallback) => {
            successCallback({ templateInstances: mockTemplateInstances, templates: mockTemplates });
        });
        mockAPI.createMetadataRedesign.mockImplementation((file, template, successCallback) => {
            successCallback();
        });

        const successCallback = jest.fn();

        const { result } = setupHook();

        expect(result.current.templateInstances).toEqual(mockTemplateInstances);
        await waitFor(() => result.current.handleCreateMetadataInstance(newTemplateInstance, successCallback));

        expect(successCallback).toHaveBeenCalled();
        expect(onSuccessMock).not.toHaveBeenCalled();
    });

    test('should handle metadata instance creation error', async () => {
        mockAPI.getMetadata.mockImplementation((file, successCallback) => {
            successCallback({ templateInstances: mockTemplateInstances, templates: mockTemplates });
        });
        mockAPI.createMetadataRedesign.mockImplementation((file, template, successCallback, errorCallback) => {
            errorCallback(mockError, 'metadata_creation_error');
        });

        const { result } = setupHook();
        expect(result.current.status).toBe(STATUS.SUCCESS);

        await waitFor(() => result.current.handleCreateMetadataInstance(newTemplateInstance, jest.fn()));

        expect(result.current.status).toBe(STATUS.ERROR);
        expect(onSuccessMock).not.toHaveBeenCalled();
        expect(onErrorMock).toHaveBeenCalledWith(
            mockError,
            'metadata_creation_error',
            expect.objectContaining({
                error: mockError,
                isErrorDisplayed: true,
            }),
        );
    });

    test('should handle metadata update', async () => {
        mockAPI.getMetadata.mockImplementation((file, successCallback) => {
            successCallback({ templateInstances: mockTemplateInstances, templates: mockTemplates });
        });
        mockAPI.updateMetadataRedesign.mockImplementation((_file, _metadataInstance, _JSONPatch, successCallback) => {
            successCallback();
        });
        const ops = [{ op: 'add', path: '/foo', value: 'bar' }];
        const successCallback = jest.fn();

        const { result } = setupHook();
        expect(result.current.templateInstances).toEqual(mockTemplateInstances);

        await waitFor(() =>
            result.current.handleUpdateMetadataInstance(mockTemplateInstances[0], ops, successCallback),
        );
        expect(successCallback).toHaveBeenCalled();
        expect(onSuccessMock).toHaveBeenCalledWith(SUCCESS_CODE_UPDATE_METADATA_TEMPLATE_INSTANCE, true);
    });

    test('should handle metadata update error', async () => {
        mockAPI.updateMetadataRedesign.mockImplementation(
            (_file, _metadataInstance, _JSONPatch, successCallback, errorCallback) => {
                errorCallback(mockError, 'metadata_update_error');
            },
        );
        const ops = [{ op: 'add', path: '/foo', value: 'bar' }];
        const successCallback = jest.fn();
        const { result } = setupHook();

        expect(result.current.templateInstances).toEqual(mockTemplateInstances);

        await waitFor(() =>
            result.current.handleUpdateMetadataInstance(mockTemplateInstances[0], ops, successCallback),
        );

        expect(successCallback).not.toHaveBeenCalled();
        expect(onSuccessMock).not.toHaveBeenCalled();

        expect(result.current.status).toEqual(STATUS.ERROR);
        expect(result.current.templates).toEqual(mockTemplates);
        expect(result.current.errorMessage).toEqual(messages.sidebarMetadataEditingErrorContent);
        expect(onErrorMock).toHaveBeenCalledWith(
            mockError,
            'metadata_update_error',
            expect.objectContaining({
                error: mockError,
                isErrorDisplayed: true,
            }),
        );
    });

    describe('extractSuggestions', () => {
        test('should extract suggestions successfully', async () => {
            const mockSuggestions = {
                field1: 'value1',
                field2: 'value2',
            };
            mockAPI.extractStructured.mockResolvedValue(mockSuggestions);

            const { result } = setupHook();

            expect(result.current.templates).toEqual(mockTemplates);

            const suggestions = await result.current.extractSuggestions('templateKey', 'global');

            expect(suggestions).toEqual([
                { ...mockTemplates[0].fields[0], aiSuggestion: 'value1' },
                { ...mockTemplates[0].fields[1], aiSuggestion: 'value2' },
            ]);
        });

        test('should handle error during suggestions extraction', async () => {
            mockAPI.extractStructured.mockRejectedValue(mockError);

            const { result } = setupHook();
            const suggestions = await result.current.extractSuggestions('templateKey', 'global');

            expect(suggestions).toEqual([]);
            expect(onSuccessMock).not.toHaveBeenCalled();
            expect(onErrorMock).toHaveBeenCalledWith(
                mockError,
                ERROR_CODE_FETCH_METADATA_SUGGESTIONS,
                expect.objectContaining({
                    showNotification: true,
                }),
            );
        });

        test('should handle empty suggestions', async () => {
            mockAPI.extractStructured.mockResolvedValue([]);

            const { result } = setupHook();
            const suggestions = await result.current.extractSuggestions('templateKey', 'global');

            expect(suggestions).toEqual([]);
            expect(onSuccessMock).not.toHaveBeenCalled();
            expect(onErrorMock).toHaveBeenCalledWith(
                new Error('No suggestions found.'),
                ERROR_CODE_EMPTY_METADATA_SUGGESTIONS,
                expect.objectContaining({
                    showNotification: true,
                }),
            );
        });
    });
});
